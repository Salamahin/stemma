/**
 * Keeps nodes off edges that are not their own. Many-body repulsion only acts
 * between nodes, so a child could settle right on top of a sibling's edge from
 * the family node, or a long edge could run through an unrelated person.
 *
 * Every other tick, every node closer than EDGE_CLEARANCE to the middle part of an
 * edge it is not on is pushed away from it, and the edge's ends are pushed the
 * other way (split by where along the edge the node is) — the same "resolve the
 * overlap" shape as d3's forceCollide. Edges are bucketed in a uniform grid
 * (flat typed arrays, reused between ticks), so a tick costs about
 * O(nodes + total edge length / cell) instead of O(nodes × edges).
 */

/** How far (world units, node radius is 15) a node is kept from the line of an edge. */
export const EDGE_CLEARANCE = 70;
/** Share of an overlap resolved per tick; split evenly between the node and the edge. */
const STRENGTH = 1;
const MIN_CELL = EDGE_CLEARANCE * 2;
/** Above this many grid cells, cells get bigger instead (huge, sparse layouts). */
const MAX_CELLS = 1 << 21;

type Node = { id: string; x: number; y: number; vx: number; vy: number; index?: number };
type Link = { source: string | Node; target: string | Node };

export function forceEdgeRepel(links: Link[]) {
    let nodes: Node[] = [];
    let byId = new Map<string, Node>();
    let src = new Int32Array(0);
    let dst = new Int32Array(0);
    let segCount = 0;
    // Grid as CSR: cellStart[c]..cellStart[c+1] index into cellSegs.
    let cellStart = new Int32Array(0);
    let cellSegs = new Int32Array(0);
    let cursor = new Int32Array(0);
    let xs = new Float64Array(0);
    let ys = new Float64Array(0);
    let dvx = new Float64Array(0);
    let dvy = new Float64Array(0);
    let stamp = new Int32Array(0);
    let tickNo = 0;
    let on = true;
    let calls = 0;

    function resolveLinks() {
        const index = new Map(nodes.map((n, i) => [n, i]));
        const of = (v: string | Node) => index.get(typeof v === "string" ? byId.get(v)! : v);
        src = new Int32Array(links.length);
        dst = new Int32Array(links.length);
        segCount = 0;
        for (const l of links) {
            const a = of(l.source);
            const b = of(l.target);
            if (a == null || b == null || a === b) continue;
            src[segCount] = a;
            dst[segCount] = b;
            segCount++;
        }
        stamp = new Int32Array(segCount);
    }

    function force(_alpha?: number) {
        if (!on || !segCount) return;
        // Every other tick: half the cost (11k people: +17% per layout instead of +33%)
        // for the same result — overlaps are resolved in full each time it runs.
        if (calls++ % 2 === 1) return;
        const n = nodes.length;
        // Work on flat copies: d3 nodes come in several shapes (people, families,
        // ghosts), and reading x/y off them in the hot loops is several times slower.
        if (xs.length < n) {
            xs = new Float64Array(n);
            ys = new Float64Array(n);
            dvx = new Float64Array(n);
            dvy = new Float64Array(n);
        }
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < n; i++) {
            const x = nodes[i].x;
            const y = nodes[i].y;
            xs[i] = x;
            ys[i] = y;
            dvx[i] = 0;
            dvy[i] = 0;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
        if (!Number.isFinite(x0 + y0 + x1 + y1)) return;
        let cell = MIN_CELL;
        while (((x1 - x0) / cell + 1) * ((y1 - y0) / cell + 1) > MAX_CELLS) cell *= 2;
        const inv = 1 / cell;
        const cols = Math.floor((x1 - x0) * inv) + 1;
        const rows = Math.floor((y1 - y0) * inv) + 1;
        const cells = cols * rows;
        if (cellStart.length < cells + 1) cellStart = new Int32Array(cells + 1);
        else cellStart.fill(0, 0, cells + 1);

        // Two passes over the cells each edge passes through: count, then fill.
        const half = cell / 2;
        for (let pass = 0; pass < 2; pass++) {
            if (pass === 1) {
                for (let c = 0; c < cells; c++) cellStart[c + 1] += cellStart[c];
                const total = cellStart[cells];
                if (cellSegs.length < total) cellSegs = new Int32Array(total * 2);
                if (cursor.length < cells) cursor = new Int32Array(cells * 2);
                cursor.set(cellStart.subarray(0, cells));
            }
            for (let s = 0; s < segCount; s++) {
                const ax = xs[src[s]] - x0;
                const ay = ys[src[s]] - y0;
                const ex = xs[dst[s]] - x0 - ax;
                const ey = ys[dst[s]] - y0 - ay;
                const steps = Math.max(1, Math.ceil(Math.sqrt(ex * ex + ey * ey) / half));
                let last = -1;
                for (let k = 0; k <= steps; k++) {
                    const t = k / steps;
                    const c = ((ay + ey * t) * inv | 0) * cols + ((ax + ex * t) * inv | 0);
                    if (c === last) continue;
                    last = c;
                    if (pass === 0) cellStart[c + 1]++;
                    else cellSegs[cursor[c]++] = s;
                }
            }
        }

        const clear2 = EDGE_CLEARANCE * EDGE_CLEARANCE;
        for (let pi = 0; pi < n; pi++) {
            tickNo++;
            const px = xs[pi];
            const py = ys[pi];
            const pc = ((px - x0) * inv) | 0;
            const pr = ((py - y0) * inv) | 0;
            const r1 = Math.min(rows - 1, pr + 1);
            const c1 = Math.min(cols - 1, pc + 1);
            for (let r = Math.max(0, pr - 1); r <= r1; r++) {
                for (let c = Math.max(0, pc - 1); c <= c1; c++) {
                    const id = r * cols + c;
                    const end = cellStart[id + 1];
                    for (let k = cellStart[id]; k < end; k++) {
                        const s = cellSegs[k];
                        if (stamp[s] === tickNo) continue;
                        stamp[s] = tickNo;
                        const ai = src[s];
                        const bi = dst[s];
                        if (ai === pi || bi === pi) continue;
                        const ax = xs[ai];
                        const ay = ys[ai];
                        const ex = xs[bi] - ax;
                        const ey = ys[bi] - ay;
                        const len2 = ex * ex + ey * ey;
                        if (len2 < 1) continue;
                        const t = ((px - ax) * ex + (py - ay) * ey) / len2;
                        // Near an end it is the other node that is close, not the edge: many-body handles that.
                        if (t <= 0 || t >= 1) continue;
                        let nx = px - (ax + t * ex);
                        let ny = py - (ay + t * ey);
                        const d2 = nx * nx + ny * ny;
                        if (d2 >= clear2) continue;
                        let dist = Math.sqrt(d2);
                        if (dist < 1e-6) {
                            // Exactly on the line: step off along the edge's normal.
                            const l = Math.sqrt(len2);
                            nx = -ey / l;
                            ny = ex / l;
                            dist = 0;
                        } else {
                            nx /= dist;
                            ny /= dist;
                        }
                        const push = (EDGE_CLEARANCE - dist) * STRENGTH * 0.5;
                        dvx[pi] += nx * push;
                        dvy[pi] += ny * push;
                        dvx[ai] -= nx * push * (1 - t);
                        dvy[ai] -= ny * push * (1 - t);
                        dvx[bi] -= nx * push * t;
                        dvy[bi] -= ny * push * t;
                    }
                }
            }
        }
        for (let i = 0; i < n; i++) {
            if (dvx[i] === 0 && dvy[i] === 0) continue;
            nodes[i].vx += dvx[i];
            nodes[i].vy += dvy[i];
        }
    }

    /** Off while a node is dragged: the dragged node and its edges would shove everyone near the pointer aside. */
    function enabled(): boolean;
    function enabled(value: boolean): typeof force;
    function enabled(value?: boolean) {
        if (value === undefined) return on;
        on = value;
        return force;
    }
    force.enabled = enabled;
    force.initialize = (ns: Node[]) => {
        nodes = ns;
        for (const n of ns) {
            n.vx ??= 0;
            n.vy ??= 0;
        }
        byId = new Map(ns.map((n) => [n.id, n]));
        resolveLinks();
    };
    return force;
}
