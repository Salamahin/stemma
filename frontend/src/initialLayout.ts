import type { StemmaIndex } from "./stemmaIndex";
import type { FamilyDescription, PersonDescription } from "./model";
import { normalizeId } from "./graphTools";

export type LayoutOptions = {
    generationHeight?: number;
    personSpacing?: number;
};

type PersonLike = Pick<PersonDescription, "id">;
type FamilyLike = Pick<FamilyDescription, "id" | "parents" | "children">;

export function computeInitialLayout(
    stemmaIndex: StemmaIndex,
    people: PersonLike[],
    families: FamilyLike[],
    width: number,
    height: number,
    options: LayoutOptions = {}
): Map<string, [number, number]> {
    const generationHeight = options.generationHeight ?? 200;
    const personSpacing = options.personSpacing ?? 160;

    const positions = new Map<string, [number, number]>();
    if (people.length === 0) return positions;

    const parentsOf = new Map<string, string[]>();
    families.forEach((f) => {
        f.children.forEach((c) => {
            const arr = parentsOf.get(c) ?? [];
            arr.push(...f.parents);
            parentsOf.set(c, arr);
        });
    });

    const byGen = new Map<number, string[]>();
    let maxGen = 0;
    people.forEach((p) => {
        const gen = stemmaIndex.lineage(p.id).generation;
        maxGen = Math.max(maxGen, gen);
        const arr = byGen.get(gen) ?? [];
        arr.push(p.id);
        byGen.set(gen, arr);
    });

    const totalHeight = Math.max(maxGen, 1) * generationHeight;
    const topY = height / 2 - totalHeight / 2;

    const assignedX = new Map<string, number>();
    const sortedGens = [...byGen.keys()].sort((a, b) => a - b);

    sortedGens.forEach((gen) => {
        const ids = byGen.get(gen)!;
        const tentative = new Map<string, number>();
        ids.forEach((id) => {
            const parents = parentsOf.get(id) ?? [];
            const parentXs = parents
                .map((pid) => assignedX.get(pid))
                .filter((v): v is number => v !== undefined);
            if (parentXs.length > 0) {
                tentative.set(id, parentXs.reduce((s, x) => s + x, 0) / parentXs.length);
            }
        });

        ids.sort((a, b) => {
            const ta = tentative.get(a);
            const tb = tentative.get(b);
            if (ta !== undefined && tb !== undefined) return ta - tb || a.localeCompare(b);
            if (ta !== undefined) return -1;
            if (tb !== undefined) return 1;
            return a.localeCompare(b);
        });

        const y = topY + gen * generationHeight;
        const rowWidth = Math.max(ids.length - 1, 0) * personSpacing;
        const startX = width / 2 - rowWidth / 2;

        ids.forEach((id, i) => {
            const x = startX + i * personSpacing;
            assignedX.set(id, x);
            positions.set(normalizeId("person", id), [x, y]);
        });
    });

    families.forEach((f) => {
        const memberIds = [...f.parents, ...f.children];
        const pts = memberIds
            .map((id) => positions.get(normalizeId("person", id)))
            .filter((p): p is [number, number] => Array.isArray(p));

        let x: number;
        let y: number;
        if (pts.length === 0) {
            x = width / 2;
            y = height / 2;
        } else {
            x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
            y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        }
        positions.set(normalizeId("family", f.id), [x, y]);
    });

    return positions;
}

type SeedNode = { id: string };
type SeedLink = { source: string | { id: string }; target: string | { id: string } };

/** Spacing for nodes seeded next to an already placed relative (≈ link distance). */
const SEED_STEP = 85;

function stableHash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0) / 2 ** 32;
}

/**
 * Starting positions for nodes that have no remembered position, placed next
 * to relatives that do (a reopened stemma with a few new people). Grows
 * outward from the known nodes: a node below its source relative (child under
 * its family, family under its spouse) or above its target relative, with a
 * small deterministic sideways spread so siblings do not coincide. Components
 * with no known relative use `fallback` (the generational layout), shifted to
 * sit to the right of the known layout.
 */
export function seedFromKnown(
    nodes: ReadonlyArray<SeedNode>,
    links: ReadonlyArray<SeedLink>,
    known: ReadonlyMap<string, [number, number]>,
    fallback?: ReadonlyMap<string, [number, number]>,
): Map<string, [number, number]> {
    const idOf = (e: string | { id: string }) => (typeof e === "string" ? e : e.id);
    const out = new Map<string, [number, number]>();
    const placed = (id: string) => known.get(id) ?? out.get(id);
    const nbrs = new Map<string, Array<{ id: string; below: boolean }>>();
    const add = (a: string, b: string, below: boolean) => {
        let arr = nbrs.get(a);
        if (!arr) nbrs.set(a, (arr = []));
        arr.push({ id: b, below });
    };
    for (const l of links) {
        const s = idOf(l.source);
        const t = idOf(l.target);
        add(t, s, true); // target sits below its source
        add(s, t, false); // source sits above its target
    }

    let frontier = nodes.filter((n) => !known.has(n.id)).map((n) => n.id);
    let progress = true;
    while (frontier.length && progress) {
        progress = false;
        const next: string[] = [];
        const batch: Array<[string, [number, number]]> = [];
        const siblingsAt = new Map<string, number>();
        for (const id of frontier) {
            const rel = (nbrs.get(id) ?? []).filter((r) => placed(r.id));
            if (rel.length === 0) {
                next.push(id);
                continue;
            }
            let x = 0;
            let y = 0;
            let dir = 0;
            for (const r of rel) {
                const p = placed(r.id)!;
                x += p[0];
                y += p[1];
                dir += r.below ? 1 : -1;
            }
            x /= rel.length;
            y /= rel.length;
            // Fan out nodes that hang off the same relatives (siblings), plus a
            // little hash jitter so the sim never starts from exact symmetry.
            const anchorKey = rel.map((r) => r.id).sort().join("|") + (dir >= 0 ? "v" : "^");
            const k = siblingsAt.get(anchorKey) ?? 0;
            siblingsAt.set(anchorKey, k + 1);
            const fan = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * SEED_STEP;
            const jitter = (stableHash(id) - 0.5) * 0.4 * SEED_STEP;
            batch.push([id, [x + fan + jitter, y + (dir >= 0 ? SEED_STEP : -SEED_STEP)]]);
        }
        if (batch.length) progress = true;
        for (const [id, p] of batch) out.set(id, p);
        frontier = next;
    }

    if (frontier.length) {
        let maxX = -Infinity;
        let minY = Infinity;
        for (const p of [...known.values(), ...out.values()]) {
            maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]);
        }
        if (!Number.isFinite(maxX)) {
            maxX = 0;
            minY = 0;
        }
        const rest = frontier.map((id) => [id, fallback?.get(id)] as const);
        let fMinX = Infinity;
        let fMinY = Infinity;
        for (const [, p] of rest) {
            if (!p) continue;
            fMinX = Math.min(fMinX, p[0]);
            fMinY = Math.min(fMinY, p[1]);
        }
        const gap = 300;
        rest.forEach(([id, p], i) => {
            if (p && Number.isFinite(fMinX)) out.set(id, [maxX + gap + (p[0] - fMinX), minY + (p[1] - fMinY)]);
            else out.set(id, [maxX + gap + (i % 10) * SEED_STEP * 2, minY + Math.floor(i / 10) * SEED_STEP * 2]);
        });
    }
    return out;
}
