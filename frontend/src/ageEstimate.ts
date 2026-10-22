import type { Stemma } from "./model";

/** Years between a parent's and a child's birth when the tree itself has no dated pairs to learn it from. */
const DEFAULT_GENERATION_YEARS = 25;
/** A learned generation length is kept within this range. */
const GENERATION_YEARS_RANGE: [number, number] = [20, 35];
/** A parent is at least this old, and at most this old, when a child is born. */
const PARENT_AGE: [number, number] = [15, 65];
/** Spouses are born at most this many years apart. */
const SPOUSE_GAP = 20;
/** Nobody lives longer than this. */
const MAX_LIFESPAN = 100;
/** Someone known only by their death year is most likely born this long before it. */
const TYPICAL_LIFESPAN = 60;
/** How much a death year pulls an estimate, next to a relative's (1). */
const DEATH_WEIGHT = 0.5;
const RELAX_ITERATIONS = 200;

export type BirthYear = { year: number; known: boolean };

export type AgeIndex = {
    /** Known or estimated birth year; null when nobody near them has a date. */
    birthYear(personId: string): BirthYear | null;
    /** 0 = the oldest in the tree, 1 = the youngest: the share of people born earlier. */
    ratio(personId: string): number;
    /** Birth years at the given ratios (0 = oldest, 0.5 = median, 1 = youngest); null when the tree has no dates. */
    yearAt(ratio: number): number | null;
    /** The years the generation length was taken to be. */
    generationYears: number;
};

function yearOf(date: string | null | undefined): number | null {
    const m = date ? /(\d{4})/.exec(date) : null;
    return m ? Number(m[1]) : null;
}

/** `generations`: +1 from a parent to a child, -1 back, 0 between spouses. */
type Edge = { to: number; generations: number };

/**
 * How old everyone in the tree is.
 *
 * Known birth years are used as they are. For everyone else the known dates first
 * bound the possible birth year (a child is born 15–65 years after a parent, spouses
 * at most 20 years apart, nobody lives past 100), and those bounds spread through
 * the tree. The estimate then balances every relative at once — a parent one
 * generation earlier, a spouse the same year, a death year ~60 years later — with
 * the generation length learned from the tree's own dated parent–child pairs, and
 * is kept within the bounds. Branches with no dates at all are ordered by generation.
 */
export function estimateAges(stemma: Stemma, now = new Date().getFullYear()): AgeIndex {
    const ids = stemma.people.map((p) => p.id);
    const index = new Map(ids.map((id, i) => [id, i]));
    const n = ids.length;
    const edges: Edge[][] = ids.map(() => []);
    const link = (a: string, b: string, generations: number) => {
        const i = index.get(a);
        const j = index.get(b);
        if (i == null || j == null || i === j) return;
        edges[i].push({ to: j, generations });
        edges[j].push({ to: i, generations: -generations });
    };
    for (const f of stemma.families) {
        const parents = f.parents ?? [];
        const children = f.children ?? [];
        for (const p of parents) for (const c of children) link(p, c, 1);
        for (let i = 1; i < parents.length; i++) link(parents[0], parents[i], 0);
    }

    const born = stemma.people.map((p) => yearOf(p.birthDate));
    const died = stemma.people.map((p) => yearOf(p.deathDate));

    // Generation length from the tree's own dated pairs.
    const gaps: number[] = [];
    for (let i = 0; i < n; i++) {
        if (born[i] == null) continue;
        for (const e of edges[i]) if (e.generations === 1 && born[e.to] != null) gaps.push(born[e.to]! - born[i]!);
    }
    gaps.sort((a, b) => a - b);
    const generationYears = gaps.length
        ? Math.min(GENERATION_YEARS_RANGE[1], Math.max(GENERATION_YEARS_RANGE[0], gaps[Math.floor(gaps.length / 2)]))
        : DEFAULT_GENERATION_YEARS;

    // 1. Bounds: what the known dates allow, spread until nothing narrows.
    const lo = new Float64Array(n).fill(-Infinity);
    const hi = new Float64Array(n).fill(now);
    for (let i = 0; i < n; i++) {
        if (born[i] != null) {
            lo[i] = hi[i] = born[i]!;
        } else if (died[i] != null) {
            lo[i] = died[i]! - MAX_LIFESPAN;
            hi[i] = Math.min(hi[i], died[i]!);
        }
    }
    for (let changed = true, pass = 0; changed && pass < 100; pass++) {
        changed = false;
        for (let i = 0; i < n; i++) {
            if (born[i] != null) continue;
            let l = lo[i];
            let h = hi[i];
            for (const e of edges[i]) {
                const [minGap, maxGap] =
                    e.generations === 0 ? [-SPOUSE_GAP, SPOUSE_GAP] : e.generations > 0 ? [-PARENT_AGE[1], -PARENT_AGE[0]] : [PARENT_AGE[0], PARENT_AGE[1]];
                // e.generations > 0: i is the parent of e.to, born 15–65 years before.
                l = Math.max(l, lo[e.to] + minGap);
                h = Math.min(h, hi[e.to] + maxGap);
            }
            if (l > h) continue; // contradictory data: keep what we had
            if (l > lo[i] + 0.5 || h < hi[i] - 0.5) {
                lo[i] = l;
                hi[i] = h;
                changed = true;
            }
        }
    }

    // 2. Estimate: start from the nearest dated relatives (multi-source BFS)...
    const year = new Float64Array(n).fill(NaN);
    let frontier: number[] = [];
    for (let i = 0; i < n; i++) {
        const y = born[i] ?? (died[i] != null ? died[i]! - TYPICAL_LIFESPAN : null);
        if (y == null) continue;
        year[i] = y;
        frontier.push(i);
    }
    while (frontier.length) {
        const sum = new Map<number, { s: number; k: number }>();
        for (const i of frontier) {
            for (const e of edges[i]) {
                if (!Number.isNaN(year[e.to])) continue;
                const acc = sum.get(e.to) ?? { s: 0, k: 0 };
                acc.s += year[i] + e.generations * generationYears;
                acc.k += 1;
                sum.set(e.to, acc);
            }
        }
        frontier = [];
        for (const [i, { s, k }] of sum) {
            year[i] = s / k;
            frontier.push(i);
        }
    }
    // ...then balance every relative at once, within the bounds.
    const clamp = (i: number, y: number) => Math.min(hi[i], Math.max(lo[i], y));
    for (let it = 0; it < RELAX_ITERATIONS; it++) {
        let moved = 0;
        for (let i = 0; i < n; i++) {
            if (born[i] != null || Number.isNaN(year[i])) continue;
            let s = 0;
            let w = 0;
            for (const e of edges[i]) {
                if (Number.isNaN(year[e.to])) continue;
                s += year[e.to] - e.generations * generationYears;
                w += 1;
            }
            if (died[i] != null) {
                s += DEATH_WEIGHT * (died[i]! - TYPICAL_LIFESPAN);
                w += DEATH_WEIGHT;
            }
            if (!w) continue;
            const y = clamp(i, s / w);
            moved = Math.max(moved, Math.abs(y - year[i]));
            year[i] = y;
        }
        if (moved < 0.1) break;
    }

    const dated: number[] = [];
    for (let i = 0; i < n; i++) if (!Number.isNaN(year[i])) dated.push(i);
    const sortedYears = dated.map((i) => year[i]).sort((a, b) => a - b);

    // Rank, not distance in years: the colours spread evenly over the people, so
    // a crowded century does not end up as one shade.
    const rank = new Float64Array(n).fill(NaN);
    if (sortedYears.length) {
        const below = (y: number) => {
            let a = 0;
            let b = sortedYears.length;
            while (a < b) {
                const m = (a + b) >> 1;
                if (sortedYears[m] < y) a = m + 1;
                else b = m;
            }
            return a;
        };
        const span = Math.max(1, sortedYears.length - 1);
        for (const i of dated) {
            const first = below(year[i]);
            const last = below(year[i] + 1e-9) - 1;
            rank[i] = (first + Math.max(first, last)) / 2 / span;
        }
    }

    // Undated branches: generation levels within their own component.
    const levelRatio = new Float64Array(n).fill(NaN);
    for (let s = 0; s < n; s++) {
        if (!Number.isNaN(year[s]) || !Number.isNaN(levelRatio[s])) continue;
        const level = new Map<number, number>([[s, 0]]);
        const queue = [s];
        for (let q = 0; q < queue.length; q++) {
            const i = queue[q];
            for (const e of edges[i]) {
                if (level.has(e.to)) continue;
                level.set(e.to, level.get(i)! + e.generations);
                queue.push(e.to);
            }
        }
        const levels = [...level.values()];
        const min = Math.min(...levels);
        const max = Math.max(...levels);
        for (const [i, l] of level) levelRatio[i] = max > min ? (l - min) / (max - min) : 0.5;
    }

    return {
        birthYear: (id) => {
            const i = index.get(id);
            if (i == null || Number.isNaN(year[i])) return null;
            return { year: Math.round(year[i]), known: born[i] != null };
        },
        ratio: (id) => {
            const i = index.get(id);
            if (i == null) return 0.5;
            if (!Number.isNaN(rank[i])) return rank[i];
            return Number.isNaN(levelRatio[i]) ? 0.5 : levelRatio[i];
        },
        yearAt: (ratio) =>
            sortedYears.length ? Math.round(sortedYears[Math.round(ratio * (sortedYears.length - 1))]) : null,
        generationYears,
    };
}
