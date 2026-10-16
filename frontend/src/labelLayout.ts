/**
 * Person-label placement on layout end. Labels are never hidden: a name that
 * silently disappears is worse than two names touching (#300).
 *
 * Greedy, in input order: each label tries 8 placements around its anchor at
 * three distances and keeps the one with the lowest cost — overlap with the
 * other labels (at their current spots) plus overlap with person circles,
 * with a small penalty for moving away from the anchor. Collision queries go
 * through uniform grids, so this stays ~linear (3000 labels in a few ms).
 */
export type LabelRect = { x: number; y: number; width: number; height: number };
export type PlacedLabel = { x: number; y: number; hidden: boolean };
export type Obstacle = { x: number; y: number; r: number };

function intersect(a: LabelRect, b: LabelRect): number {
    if (a.x >= b.x + b.width || a.x + a.width <= b.x || a.y >= b.y + b.height || a.y + a.height <= b.y) return 0;
    const left = Math.max(a.x, b.x);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const top = Math.max(a.y, b.y);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return (right - left) * (bottom - top);
}

const RINGS = [0, 1, 2];
// Weight of covering a circle relative to covering another label, and the
// cost of moving one label-height further from the anchor.
const OBSTACLE_WEIGHT = 2;
const DISTANCE_PENALTY = 0.05;

function placements(r: LabelRect): LabelRect[] {
    const out: LabelRect[] = [];
    for (const ring of RINGS) {
        const d = ring * r.height;
        for (const p of basePlacements(r)) {
            const dx = Math.sign(p.x - r.x) * d;
            const dy = Math.sign(p.y - r.y) * d || (p.x === r.x && p.y === r.y ? d : 0);
            out.push({ ...p, x: p.x + dx, y: p.y + dy });
        }
    }
    return out;
}

function basePlacements(r: LabelRect): LabelRect[] {
    const { x, y, width: w, height: h } = r;
    return [
        { x, y, width: w, height: h },
        { x: x - w, y, width: w, height: h },
        { x: x - w, y: y - h, width: w, height: h },
        { x, y: y - h, width: w, height: h },
        { x, y: y - h / 2, width: w, height: h },
        { x: x - w / 2, y, width: w, height: h },
        { x: x - w, y: y - h / 2, width: w, height: h },
        { x: x - w / 2, y: y - h, width: w, height: h },
    ];
}

class Grid {
    private cells = new Map<string, Set<number>>();
    private keysOf: string[][] = [];

    constructor(private cell: number) {}

    private keys(r: LabelRect): string[] {
        const c = this.cell;
        const x0 = Math.floor(r.x / c), x1 = Math.floor((r.x + r.width) / c);
        const y0 = Math.floor(r.y / c), y1 = Math.floor((r.y + r.height) / c);
        const out: string[] = [];
        for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) out.push(gx + ":" + gy);
        return out;
    }

    insert(i: number, r: LabelRect) {
        const ks = this.keys(r);
        this.keysOf[i] = ks;
        for (const k of ks) {
            let s = this.cells.get(k);
            if (!s) this.cells.set(k, (s = new Set()));
            s.add(i);
        }
    }

    remove(i: number) {
        for (const k of this.keysOf[i] ?? []) this.cells.get(k)?.delete(i);
        this.keysOf[i] = [];
    }

    /** Indices whose cells touch `r`, ascending (summation order matches a linear scan). */
    near(r: LabelRect): number[] {
        const seen = new Set<number>();
        for (const k of this.keys(r)) {
            const s = this.cells.get(k);
            if (s) for (const i of s) seen.add(i);
        }
        return [...seen].sort((a, b) => a - b);
    }
}

export function placeLabels(input: ReadonlyArray<LabelRect>, obstacles: ReadonlyArray<Obstacle> = []): PlacedLabel[] {
    const n = input.length;
    if (n === 0) return [];
    let maxDim = 1;
    for (const r of input) maxDim = Math.max(maxDim, r.width, r.height);
    const grid = new Grid(maxDim * 2);
    const rects: LabelRect[] = input.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
    rects.forEach((r, i) => grid.insert(i, r));

    const circles: LabelRect[] = obstacles.map((o) => ({ x: o.x - o.r, y: o.y - o.r, width: 2 * o.r, height: 2 * o.r }));
    const circleGrid = new Grid(maxDim * 2);
    circles.forEach((c, i) => circleGrid.insert(i, c));

    const cost = (r: LabelRect, self: number) => {
        let sum = 0;
        for (const j of grid.near(r)) if (j !== self) sum += intersect(r, rects[j]);
        for (const j of circleGrid.near(r)) sum += OBSTACLE_WEIGHT * intersect(r, circles[j]);
        return sum;
    };

    for (let i = 0; i < n; i++) {
        const anchor = input[i];
        let best = rects[i];
        let bestScore = cost(best, i);
        if (bestScore === 0) continue;
        for (const p of placements(anchor)) {
            const moved = Math.hypot(p.x - anchor.x, p.y - anchor.y) / anchor.height;
            const s = cost(p, i) + DISTANCE_PENALTY * moved * anchor.width * anchor.height;
            if (s < bestScore) {
                best = p;
                bestScore = s;
            }
        }
        if (best !== rects[i]) {
            grid.remove(i);
            rects[i] = best;
            grid.insert(i, best);
        }
    }

    return rects.map((r) => ({ x: r.x, y: r.y, hidden: false }));
}
