/**
 * Structured starting layout for stemmas without a remembered layout.
 *
 * A force layout started from a poor seed (everyone on one row per
 * generation, ~100k units wide for large stemmas) gets crumpled by the
 * centring forces into a heap full of crossings. This builds a seed that is
 * already untangled and has the force equilibrium's rough shape (a disc of
 * even density), so the simulation only has to refine it:
 *
 * 1. generations — longest path over the family DAG (child = family + 1),
 *    married-in spouses aligned with their partner's family;
 * 2. connected components laid out separately;
 * 3. within-generation order — DFS seed + barycenter sweeps (crossing
 *    minimisation), spouses kept adjacent as blocks;
 * 4. generations on concentric rings (oldest inside), each ring's
 *    circumference sized to its population, angles from the order;
 * 5. components packed as circles (d3.packSiblings).
 *
 * Pure and index-based so it runs in the layout worker.
 */
import { packSiblings, forceSimulation, forceLink, forceCollide, forceX, forceY } from "d3";

export type StructuredLayoutOptions = {
    /** Arc length between neighbouring people on a ring. */
    personSpacing?: number;
    /** Arc length between neighbouring families on a ring. */
    familySpacing?: number;
    /** Radial distance between a generation's ring and the next one. */
    generationGap?: number;
    /** Barycenter sweeps (each = one down + one up pass). */
    sweeps?: number;
    /** Gap between packed components. */
    componentGap?: number;
    /**
     * "clans": every surname clan gets its own region (laid out with rings),
     * regions kept apart; "rings": one set of generation rings per component.
     */
    mode?: "clans" | "rings";
    /** Clans: clear space between neighbouring clan regions. */
    regionGap?: number;
    /** Clans: ticks of the small region-graph layout that places the regions. */
    regionTicks?: number;
    /** Clans: start regions packed ("pack") or at their rings-layout centroids ("rings"). */
    regionStart?: "pack" | "rings";
    /** Clans: components smaller than this use plain rings. */
    minClanComponent?: number;
};

// Tuned with e2e/bench/seedExperiment.mjs: the seed is somewhat denser than
// the force equilibrium so the refine expands it instead of folding it.
const DEFAULTS: Required<StructuredLayoutOptions> = {
    personSpacing: 50,
    familySpacing: 20,
    generationGap: 110,
    sweeps: 4,
    componentGap: 150,
    mode: "clans",
    regionGap: 500,
    regionTicks: 100,
    regionStart: "rings",
    minClanComponent: 200,
};

export type StructuredLayoutInput = {
    /** Node ids; families start with "family_", everything else is a person. */
    ids: ReadonlyArray<string>;
    /** Flattened [source, target] index pairs: person→family (parent), family→person (child). */
    links: ArrayLike<number>;
    center: [number, number];
    /** Optional clan index per node (-1: none), for the "clans" mode. */
    groups?: ArrayLike<number>;
};

export function structuredLayout(
    input: StructuredLayoutInput,
    options: StructuredLayoutOptions = {},
): { x: Float64Array; y: Float64Array; region: Int32Array } {
    const opt = { ...DEFAULTS, ...options };
    const n = input.ids.length;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    /** Clan region per node (clans mode), -1 elsewhere. */
    const regionOf = new Int32Array(n).fill(-1);
    if (n === 0) return { x, y, region: regionOf };
    const isFamily = new Uint8Array(n);
    const inUnit = new Uint8Array(n); // membership of the node set being laid out
    input.ids.forEach((id, i) => (isFamily[i] = id.startsWith("family_") ? 1 : 0));

    // --- structure ---------------------------------------------------------
    const parentsOf: number[][] = Array.from({ length: n }, () => []); // family → parents
    const childrenOf: number[][] = Array.from({ length: n }, () => []); // family → children
    const ownFamilies: number[][] = Array.from({ length: n }, () => []); // person → families as parent
    const parentFamily = new Int32Array(n).fill(-1); // person → family as child
    const nbrs: number[][] = Array.from({ length: n }, () => []);
    const uf = new Int32Array(n).map((_, i) => i);
    const find = (a: number): number => {
        while (uf[a] !== a) a = uf[a] = uf[uf[a]];
        return a;
    };
    for (let i = 0; i + 1 < input.links.length; i += 2) {
        const s = input.links[i];
        const t = input.links[i + 1];
        if (s < 0 || t < 0 || s >= n || t >= n || s === t) continue;
        if (!isFamily[s] && isFamily[t]) {
            parentsOf[t].push(s);
            ownFamilies[s].push(t);
        } else if (isFamily[s] && !isFamily[t]) {
            childrenOf[s].push(t);
            if (parentFamily[t] < 0) parentFamily[t] = s;
        } else continue;
        nbrs[s].push(t);
        nbrs[t].push(s);
        uf[find(s)] = find(t);
    }

    // --- clan regions (every node joins the clan nearest to it) ---------------
    if (input.groups) regionOf.set(clanRegions(n, input.links, input.groups));

    // --- generations ---------------------------------------------------------
    // familyRank(f) = max over parents p of (familyRank(parentFamily(p)) + 1), 0 for roots.
    const famRank = new Int32Array(n).fill(-1);
    const state = new Uint8Array(n); // 0 new, 1 visiting, 2 done
    const rankOfFamily = (f0: number): number => {
        // iterative DFS (deep pedigrees would overflow recursion)
        const stack = [f0];
        while (stack.length) {
            const f = stack[stack.length - 1];
            if (state[f] === 2) {
                stack.pop();
                continue;
            }
            state[f] = 1;
            let ready = true;
            for (const p of parentsOf[f]) {
                const pf = parentFamily[p];
                if (pf >= 0 && state[pf] === 0) {
                    stack.push(pf);
                    ready = false;
                }
            }
            if (!ready) continue;
            let r = 0;
            for (const p of parentsOf[f]) {
                const pf = parentFamily[p];
                if (pf >= 0 && state[pf] === 2) r = Math.max(r, famRank[pf] + 1);
                // pf still "visiting" = a cycle (rejected by the backend): ignore that edge
            }
            famRank[f] = r;
            state[f] = 2;
            stack.pop();
        }
        return famRank[f0];
    };
    for (let i = 0; i < n; i++) if (isFamily[i]) rankOfFamily(i);
    // layer: people on even layers (2·generation), families between (2·rank + 1)
    const layer = new Int32Array(n);
    for (let i = 0; i < n; i++) {
        if (isFamily[i]) layer[i] = 2 * famRank[i] + 1;
        else if (parentFamily[i] >= 0) layer[i] = 2 * (famRank[parentFamily[i]] + 1);
        else if (ownFamilies[i].length) layer[i] = 2 * Math.min(...ownFamilies[i].map((f) => famRank[f]));
        else layer[i] = 0;
    }

    // --- components -----------------------------------------------------------
    const compOf = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
        const r = find(i);
        let arr = compOf.get(r);
        if (!arr) compOf.set(r, (arr = []));
        arr.push(i);
    }

    const circles: Array<{ r: number; x: number; y: number; members: number[] }> = [];
    for (const members of compOf.values()) {
        circles.push(
            opt.mode === "clans" ? clansComponent(members) : layoutComponent(members),
        );
    }

    /** Generation-rings layout of `members` (relative to 0,0); only edges inside the set count. */
    function layoutComponent(members: number[]) {
        for (const v of members) inUnit[v] = 1;
        try {
            return ringsOf(members);
        } finally {
            for (const v of members) inUnit[v] = 0;
        }
    }

    function ringsOf(members: number[]) {
        let minL = Infinity;
        let maxL = -Infinity;
        for (const v of members) {
            minL = Math.min(minL, layer[v]);
            maxL = Math.max(maxL, layer[v]);
        }
        const layers: number[][] = Array.from({ length: maxL - minL + 1 }, () => []);
        // DFS order from the oldest nodes gives sweeps a coherent start
        const seen = new Set<number>();
        const roots = members.filter((v) => layer[v] === minL);
        const visit = (start: number) => {
            const stack = [start];
            while (stack.length) {
                const v = stack.pop()!;
                if (seen.has(v)) continue;
                seen.add(v);
                layers[layer[v] - minL].push(v);
                for (let k = nbrs[v].length - 1; k >= 0; k--) if (inUnit[nbrs[v][k]] && !seen.has(nbrs[v][k])) stack.push(nbrs[v][k]);
            }
        };
        for (const r of roots) visit(r);
        for (const v of members) if (!seen.has(v)) visit(v);

        // spouse blocks: people of one layer who parent the same family move together
        const blockOf = new Map<number, number>();
        for (const v of members) {
            if (isFamily[v]) continue;
            for (const f of ownFamilies[v]) {
                for (const p of parentsOf[f]) {
                    if (p !== v && inUnit[p] && layer[p] === layer[v]) {
                        const a = blockOf.get(v) ?? v;
                        const b = blockOf.get(p) ?? p;
                        if (a !== b) {
                            for (const [k, val] of blockOf) if (val === b) blockOf.set(k, a);
                            blockOf.set(p, a);
                            blockOf.set(b, a);
                        }
                        blockOf.set(v, a);
                    }
                }
            }
        }

        const pos = new Float64Array(n); // normalised position within the layer, 0..1
        const setPositions = (l: number) => {
            const arr = layers[l];
            arr.forEach((v, i) => (pos[v] = (i + 0.5) / arr.length));
        };
        for (let l = 0; l < layers.length; l++) setPositions(l);

        const reorder = (l: number, towards: -1 | 1) => {
            const arr = layers[l];
            if (arr.length < 2) return;
            const bary = new Map<number, number>();
            for (const v of arr) {
                let sum = 0;
                let cnt = 0;
                for (const u of nbrs[v]) {
                    if (!inUnit[u]) continue;
                    const lu = layer[u] - minL;
                    if (towards < 0 ? lu < l : lu > l) {
                        sum += pos[u];
                        cnt++;
                    }
                }
                bary.set(v, cnt ? sum / cnt : pos[v]);
            }
            // blocks sort by their mean barycenter and stay contiguous
            const groups = new Map<number, number[]>();
            for (const v of arr) {
                const b = blockOf.get(v) ?? v;
                let g = groups.get(b);
                if (!g) groups.set(b, (g = []));
                g.push(v);
            }
            const keyed = [...groups.values()].map((g) => {
                g.sort((a, b) => bary.get(a)! - bary.get(b)! || pos[a] - pos[b]);
                const key = g.reduce((s, v) => s + bary.get(v)!, 0) / g.length;
                const tie = g.reduce((s, v) => s + pos[v], 0) / g.length;
                return { g, key, tie };
            });
            keyed.sort((a, b) => a.key - b.key || a.tie - b.tie);
            layers[l] = keyed.flatMap((k) => k.g);
            setPositions(l);
        };
        for (let s = 0; s < opt.sweeps; s++) {
            for (let l = 1; l < layers.length; l++) reorder(l, -1);
            for (let l = layers.length - 2; l >= 0; l--) reorder(l, 1);
        }

        // rings
        let radius = 0;
        let maxR = 0;
        for (let l = 0; l < layers.length; l++) {
            const arr = layers[l];
            const isFamLayer = arr.length > 0 && isFamily[arr[0]] === 1;
            const spacing = isFamLayer ? opt.familySpacing : opt.personSpacing;
            const need = arr.length > 1 ? (arr.length * spacing) / (2 * Math.PI) : 0;
            radius = l === 0 ? need : Math.max(radius + opt.generationGap / 2, need);
            maxR = Math.max(maxR, radius);
            arr.forEach((v) => {
                const a = 2 * Math.PI * pos[v];
                x[v] = radius * Math.cos(a);
                y[v] = radius * Math.sin(a);
            });
        }
        return { r: maxR + opt.componentGap / 2, x: 0, y: 0, members };
    }

    /**
     * Clan regions: every node joins the clan nearest to it in the family
     * graph (multi-source BFS from the clan members); each region is laid
     * out with generation rings, and the regions are packed as circles with
     * `regionGap` between them, related regions first (BFS over the region
     * graph from the biggest one) so they end up next to each other. A
     * surname cloud is the hull of its members, so keeping each clan inside
     * its own disc keeps the clouds apart.
     */
    function clansComponent(members: number[]) {
        if (!input.groups || members.length < opt.minClanComponent || !members.some((v) => regionOf[v] >= 0)) return layoutComponent(members);
        const region = { get: (v: number) => regionOf[v] };
        const byRegion = new Map<number, number[]>();
        for (const v of members) {
            const g = regionOf[v];
            let arr = byRegion.get(g);
            if (!arr) byRegion.set(g, (arr = []));
            arr.push(v);
        }
        // region adjacency, for a neighbour-preserving packing order
        const adj = new Map<number, Map<number, number>>();
        for (const v of members) {
            const a = region.get(v) ?? -1;
            for (const u of nbrs[v]) {
                const b = region.get(u) ?? -1;
                if (a === b) continue;
                let m = adj.get(a);
                if (!m) adj.set(a, (m = new Map()));
                m.set(b, (m.get(b) ?? 0) + 1);
            }
        }
        const regions = [...byRegion.keys()];
        regions.sort((p, q) => byRegion.get(q)!.length - byRegion.get(p)!.length);
        const orderRegions: number[] = [];
        const seenRegion = new Set<number>();
        for (const start of regions) {
            if (seenRegion.has(start)) continue;
            const queue = [start];
            seenRegion.add(start);
            for (let h = 0; h < queue.length; h++) {
                const r = queue[h];
                orderRegions.push(r);
                const ns = [...(adj.get(r) ?? new Map()).entries()].sort((p, q) => q[1] - p[1]).map(([k]) => k);
                for (const k of ns) {
                    if (seenRegion.has(k)) continue;
                    seenRegion.add(k);
                    queue.push(k);
                }
            }
        }
        const discs = orderRegions.map((r) => {
            const nodes = byRegion.get(r)!;
            const local = layoutComponent(nodes);
            return { nodes, lx: nodes.map((v) => x[v]), ly: nodes.map((v) => y[v]), r: local.r + opt.regionGap / 2, x: 0, y: 0 };
        });
        if (opt.regionStart === "rings") {
            // Start every region where the (low-crossing) rings layout of the
            // whole component puts the clan's centroid, scaled up so the discs
            // fit; the region layout below then only separates them.
            layoutComponent(members);
            let area = 0;
            let ringsR = 1;
            for (const v of members) ringsR = Math.max(ringsR, Math.hypot(x[v], y[v]));
            for (const d of discs) area += d.r * d.r;
            const scale = Math.max(1, (1.3 * Math.sqrt(area)) / ringsR);
            for (const d of discs) {
                let cx = 0;
                let cy = 0;
                for (const v of d.nodes) {
                    cx += x[v];
                    cy += y[v];
                }
                d.x = (cx / d.nodes.length) * scale;
                d.y = (cy / d.nodes.length) * scale;
            }
        } else {
            packSiblings(discs as any);
        }
        // Pull connected regions next to each other (links weighted by how many
        // family edges join them), discs kept apart by collision: inter-clan
        // relatives end up close and their connecting lines short.
        const regionIndex = new Map(orderRegions.map((r, i) => [r, i]));
        const regionLinks: Array<{ source: number; target: number; w: number }> = [];
        for (const [a, m] of adj) {
            for (const [b, w] of m) {
                if (a < b) regionLinks.push({ source: regionIndex.get(a)!, target: regionIndex.get(b)!, w });
            }
        }
        const maxW = Math.max(1, ...regionLinks.map((l) => l.w));
        const regionSim = forceSimulation(discs as any)
            .force(
                "link",
                forceLink(regionLinks)
                    .distance((l: any) => discs[l.source.index].r + discs[l.target.index].r)
                    .strength((l: any) => 0.05 + 0.6 * (l.w / maxW)),
            )
            .force("collide", forceCollide((d: any) => d.r).iterations(3))
            .force("x", forceX(0).strength(0.02))
            .force("y", forceY(0).strength(0.02))
            .stop();
        for (let i = 0; i < opt.regionTicks; i++) regionSim.tick();
        let extent = 0;
        for (const d of discs) {
            d.nodes.forEach((v, j) => {
                x[v] = d.x + d.lx[j];
                y[v] = d.y + d.ly[j];
            });
            extent = Math.max(extent, Math.hypot(d.x, d.y) + d.r);
        }
        return { r: extent + opt.componentGap / 2, x: 0, y: 0, members };
    }

    // --- pack components ----------------------------------------------------------
    circles.sort((a, b) => b.r - a.r);
    packSiblings(circles as any);
    for (const c of circles) {
        for (const v of c.members) {
            x[v] += c.x + input.center[0];
            y[v] += c.y + input.center[1];
        }
    }
    // Open on people, not on a gap between regions: put the node closest to
    // the median position at the centre.
    const xsSorted = Array.from(x).sort((a, b) => a - b);
    const ysSorted = Array.from(y).sort((a, b) => a - b);
    const mx = xsSorted[n >> 1];
    const my = ysSorted[n >> 1];
    let nearest = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
        const dd = (x[i] - mx) ** 2 + (y[i] - my) ** 2;
        if (dd < bestD) {
            bestD = dd;
            nearest = i;
        }
    }
    const dx = input.center[0] - x[nearest];
    const dy = input.center[1] - y[nearest];
    for (let i = 0; i < n; i++) {
        x[i] += dx;
        y[i] += dy;
    }
    return { x, y, region: regionOf };
}

/**
 * Moves every node that is not fixed (fx/fy) to its structured-layout
 * position and zeroes its velocity. `links` are [source, target] index pairs.
 */
export function applyStructuredSeed(
    nodes: Array<{ id: string; x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null; region?: number; ax?: number; ay?: number }>,
    links: ArrayLike<number>,
    center: [number, number],
    groups?: ArrayLike<number>,
) {
    const { x, y, region } = structuredLayout({ ids: nodes.map((d) => d.id), links, center, groups });
    nodes.forEach((d, i) => {
        if (d.fx == null) d.x = x[i];
        if (d.fy == null) d.y = y[i];
        d.vx = 0;
        d.vy = 0;
        d.region = region[i];
        // the seed is where every node belongs: it becomes the anchor
        d.ax = d.x;
        d.ay = d.y;
    });
}

/**
 * Clan region of every node: clan members (`groups[v] >= 0`) seed a
 * multi-source BFS over the family graph, so every other person and family
 * joins the clan nearest to it (-1 where no clan is reachable).
 * `links` are [source, target] index pairs.
 */
export function clanRegions(n: number, links: ArrayLike<number>, groups: ArrayLike<number>): Int32Array {
    const out = new Int32Array(n).fill(-1);
    const nbrs: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i + 1 < links.length; i += 2) {
        const s = links[i];
        const t = links[i + 1];
        if (s < 0 || t < 0 || s >= n || t >= n) continue;
        nbrs[s].push(t);
        nbrs[t].push(s);
    }
    let frontier: number[] = [];
    for (let v = 0; v < n; v++) {
        const g = groups[v];
        if (g != null && g >= 0) {
            out[v] = g;
            frontier.push(v);
        }
    }
    while (frontier.length) {
        const next: number[] = [];
        for (const v of frontier) {
            for (const u of nbrs[v]) {
                if (out[u] >= 0) continue;
                out[u] = out[v];
                next.push(u);
            }
        }
        frontier = next;
    }
    return out;
}
