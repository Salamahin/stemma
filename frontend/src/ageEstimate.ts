import type { Stemma } from "./model";

/** Years between a parent's birth and their child's. */
const GENERATION_YEARS = 28;
/** A person known only by their death year is taken to be born this long before it. */
const LIFESPAN_YEARS = 60;
/** The colour scale spans this share of birth years, so a few outliers do not flatten everyone else. */
const RANGE_PERCENTILES: [number, number] = [0.02, 0.98];

export type BirthYear = { year: number; known: boolean };

export type AgeIndex = {
    /** Known or estimated birth year; null when nobody near them has a date. */
    birthYear(personId: string): BirthYear | null;
    /** 0 = the oldest in the tree, 1 = the youngest. */
    ratio(personId: string): number;
    /** The birth years the scale runs over, oldest first; null when the tree has no dates. */
    yearRange(): [number, number] | null;
};

function yearOf(date: string | null | undefined): number | null {
    const m = date ? /(\d{4})/.exec(date) : null;
    return m ? Number(m[1]) : null;
}

type Edge = { to: string; generations: number };

/**
 * How old everyone in the tree is: their birth year when it is known, otherwise
 * an estimate from the nearest relatives who have one (a parent ~28 years older,
 * a spouse or sibling the same age). Trees or branches with no dates at all are
 * ordered by generation instead.
 */
export function estimateAges(stemma: Stemma): AgeIndex {
    const edges = new Map<string, Edge[]>(stemma.people.map((p) => [p.id, []]));
    const link = (a: string, b: string, generations: number) => {
        if (!edges.has(a) || !edges.has(b) || a === b) return;
        edges.get(a)!.push({ to: b, generations });
        edges.get(b)!.push({ to: a, generations: -generations });
    };
    for (const f of stemma.families) {
        const parents = f.parents ?? [];
        const children = f.children ?? [];
        for (const p of parents) for (const c of children) link(p, c, 1);
        for (let i = 1; i < parents.length; i++) link(parents[0], parents[i], 0);
    }

    // Multi-source BFS from everyone with a date: each undated person takes the
    // mean of what their nearest dated relatives imply.
    const years = new Map<string, BirthYear>();
    let frontier: string[] = [];
    for (const p of stemma.people) {
        const born = yearOf(p.birthDate);
        const died = yearOf(p.deathDate);
        const year = born ?? (died != null ? died - LIFESPAN_YEARS : null);
        if (year == null) continue;
        years.set(p.id, { year, known: born != null });
        frontier.push(p.id);
    }
    while (frontier.length) {
        const sums = new Map<string, { sum: number; n: number }>();
        for (const id of frontier) {
            const from = years.get(id)!.year;
            for (const e of edges.get(id)!) {
                if (years.has(e.to)) continue;
                const s = sums.get(e.to) ?? { sum: 0, n: 0 };
                s.sum += from + e.generations * GENERATION_YEARS;
                s.n += 1;
                sums.set(e.to, s);
            }
        }
        frontier = [];
        for (const [id, s] of sums) {
            years.set(id, { year: Math.round(s.sum / s.n), known: false });
            frontier.push(id);
        }
    }

    const sorted = [...years.values()].map((y) => y.year).sort((a, b) => a - b);
    const range: [number, number] | null = sorted.length
        ? [
              sorted[Math.floor(RANGE_PERCENTILES[0] * (sorted.length - 1))],
              sorted[Math.ceil(RANGE_PERCENTILES[1] * (sorted.length - 1))],
          ]
        : null;

    // Undated branches: generation levels within their own component.
    const levelRatio = new Map<string, number>();
    for (const p of stemma.people) {
        if (years.has(p.id) || levelRatio.has(p.id)) continue;
        const level = new Map<string, number>([[p.id, 0]]);
        const queue = [p.id];
        for (let i = 0; i < queue.length; i++) {
            const id = queue[i];
            for (const e of edges.get(id)!) {
                if (level.has(e.to)) continue;
                level.set(e.to, level.get(id)! + e.generations);
                queue.push(e.to);
            }
        }
        const levels = [...level.values()];
        const min = Math.min(...levels);
        const max = Math.max(...levels);
        for (const [id, l] of level) levelRatio.set(id, max > min ? (l - min) / (max - min) : 0.5);
    }

    return {
        birthYear: (id) => years.get(id) ?? null,
        ratio: (id) => {
            const y = years.get(id);
            if (y && range) {
                const [lo, hi] = range;
                return hi > lo ? Math.min(1, Math.max(0, (y.year - lo) / (hi - lo))) : 0.5;
            }
            return levelRatio.get(id) ?? 0.5;
        },
        yearRange: () => range,
    };
}
