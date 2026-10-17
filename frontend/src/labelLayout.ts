/**
 * Person-label placement: the same algorithm as d3fc-label-layout's
 * `layoutRemoveOverlaps(layoutGreedy())`, but with collision queries served by
 * a uniform grid instead of scanning every label. d3fc is O(n²) per query
 * (~220 ms for 1000 labels, run on every layout end); this is ~linear.
 *
 * Greedy: for each label in order, try 8 placements around its anchor and
 * keep any that strictly lowers its overlap with the current labels.
 * Remove overlaps: repeatedly hide the visible label with the largest total
 * overlap (first one on ties) until no visible labels overlap.
 */
export type LabelRect = { x: number; y: number; width: number; height: number };
export type PlacedLabel = { x: number; y: number; hidden: boolean };

function intersect(a: LabelRect, b: LabelRect): number {
    if (a.x >= b.x + b.width || a.x + a.width <= b.x || a.y >= b.y + b.height || a.y + a.height <= b.y) return 0;
    const left = Math.max(a.x, b.x);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const top = Math.max(a.y, b.y);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return (right - left) * (bottom - top);
}

function placements(r: LabelRect): LabelRect[] {
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

export function placeLabels(input: ReadonlyArray<LabelRect>): PlacedLabel[] {
    const n = input.length;
    if (n === 0) return [];
    let maxDim = 1;
    for (const r of input) maxDim = Math.max(maxDim, r.width, r.height);
    const grid = new Grid(maxDim * 2);
    const rects: LabelRect[] = input.map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
    rects.forEach((r, i) => grid.insert(i, r));

    const collision = (r: LabelRect, self: number, alive?: Uint8Array) => {
        let sum = 0;
        for (const j of grid.near(r)) {
            if (j === self || (alive && !alive[j])) continue;
            sum += intersect(r, rects[j]);
        }
        return sum;
    };

    // greedy
    for (let i = 0; i < n; i++) {
        let best = rects[i];
        let bestScore = collision(best, i);
        for (const p of placements(input[i])) {
            const s = collision(p, i);
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

    // remove overlaps
    const alive = new Uint8Array(n).fill(1);
    const area = rects.map((r, i) => collision(r, i, alive));
    for (;;) {
        let worst = -1;
        let worstArea = 0;
        for (let i = 0; i < n; i++) {
            if (alive[i] && area[i] > worstArea) {
                worst = i;
                worstArea = area[i];
            }
        }
        if (worst < 0) break;
        alive[worst] = 0;
        for (const j of grid.near(rects[worst])) {
            if (j !== worst && alive[j]) area[j] = collision(rects[j], j, alive);
        }
    }

    return rects.map((r, i) => ({ x: r.x, y: r.y, hidden: !alive[i] }));
}
