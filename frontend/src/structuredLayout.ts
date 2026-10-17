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
    mode?: "star" | "clans" | "rings" | "layered";
    /** Star: minimum distance between neighbouring nodes on the same ring. */
    starSpacing?: number;
    /** Star: minimum distance between consecutive tree depths. */
    starLevelGap?: number;
    /** Star: crossing-reduction passes over the children order (0 = off). */
    starOrderPasses?: number;
    /** Clans: clear space between neighbouring clan regions. */
    regionGap?: number;
    /** Clans: ticks of the small region-graph layout that places the regions. */
    regionTicks?: number;
    /** Clans: start regions packed ("pack") or at their rings-layout centroids ("rings"). */
    regionStart?: "pack" | "rings";
    /** Clans: smallest gap between regions; strongly connected regions get close to it, unrelated ones keep `regionGap`. */
    regionGapMin?: number;
    /** Clans: rotate/mirror every region so its boundary people face the clans they are related to. */
    islandRotation?: boolean;
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
    mode: "star",
    regionGap: 500,
    regionTicks: 100,
    regionStart: "rings",
    starSpacing: 80,
    starLevelGap: 85,
    starOrderPasses: 6,
    regionGapMin: 150,
    islandRotation: true,
    minClanComponent: 200,
};

/**
 * Whether the default seed uses clan regions (and with them weak links
 * between clans in the force refine). The star layout does not: weakening
 * cross-clan links there only added crossings.
 */
export const SEED_USES_CLAN_REGIONS = DEFAULTS.mode === "clans";

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
): { x: Float64Array; y: Float64Array; region: Int32Array; nonTreeEdges: number[] } {
    const opt = { ...DEFAULTS, ...options };
    const n = input.ids.length;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    /** Clan region per node (clans mode), -1 elsewhere. */
    const regionOf = new Int32Array(n).fill(-1);
    /** Star mode: [a, b] index pairs of edges left out of the spanning tree. */
    const nonTreeEdges: number[] = [];
    if (n === 0) return { x, y, region: regionOf, nonTreeEdges };
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
            opt.mode === "star"
                ? starComponent(members)
                : opt.mode === "clans"
                  ? clansComponent(members)
                  : layoutComponent(members), // "rings" and "layered" share ringsOf
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

        if (opt.mode === "layered") {
            // generations as rows (Sugiyama-style reference), same ordering
            let maxHalf = 0;
            for (let l = 0; l < layers.length; l++) {
                const arr = layers[l];
                const isFamLayer = arr.length > 0 && isFamily[arr[0]] === 1;
                const spacing = isFamLayer ? opt.familySpacing : opt.personSpacing * 2;
                const width = arr.length * spacing;
                maxHalf = Math.max(maxHalf, width / 2);
                arr.forEach((v) => {
                    x[v] = pos[v] * width - width / 2;
                    y[v] = l * (opt.generationGap / 2) - (layers.length * opt.generationGap) / 4;
                });
            }
            return { r: Math.hypot(maxHalf, (layers.length * opt.generationGap) / 4) + opt.componentGap / 2, x: 0, y: 0, members };
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
            return { nodes, lx: nodes.map((v) => x[v]), ly: nodes.map((v) => y[v]), r: local.r + opt.regionGapMin / 2, x: 0, y: 0 };
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
                    .distance((l: any) => discs[l.source.index].r + discs[l.target.index].r + (opt.regionGap - opt.regionGapMin) * (1 - l.w / maxW))
                    .strength((l: any) => 0.05 + 0.6 * (l.w / maxW)),
            )
            .force("collide", forceCollide((d: any) => d.r).iterations(3))
            .force("x", forceX(0).strength(0.02))
            .force("y", forceY(0).strength(0.02))
            .stop();
        for (let i = 0; i < opt.regionTicks; i++) regionSim.tick();
        if (opt.islandRotation) {
            // Turn (and possibly mirror) every island so that its boundary
            // people — those with relatives in other clans — face those clans:
            // minimise Σ |p(u) − centre(other clan)|² over inter-clan edges.
            const centre = new Map<number, [number, number]>();
            discs.forEach((d, i) => centre.set(orderRegions[i], [d.x, d.y]));
            discs.forEach((d) => {
                const terms: Array<{ j: number; tx: number; ty: number }> = [];
                d.nodes.forEach((v, j) => {
                    for (const u of nbrs[v]) {
                        const b = regionOf[u];
                        if (b === regionOf[v] || b < 0) continue;
                        const c = centre.get(b);
                        if (c) terms.push({ j, tx: c[0] - d.x, ty: c[1] - d.y });
                    }
                });
                if (!terms.length) return;
                let best = { cost: Infinity, angle: 0, mirror: 1 };
                for (const mirror of [1, -1]) {
                    // closed form: maximise Σ (R·m·p)·t  ⇒  angle = atan2(Σ cross, Σ dot)
                    let dot = 0;
                    let cross = 0;
                    for (const t of terms) {
                        const px = d.lx[t.j];
                        const py = mirror * d.ly[t.j];
                        dot += px * t.tx + py * t.ty;
                        cross += px * t.ty - py * t.tx;
                    }
                    const angle = Math.atan2(cross, dot);
                    const c = Math.cos(angle);
                    const sn = Math.sin(angle);
                    let cost = 0;
                    for (const t of terms) {
                        const px = d.lx[t.j];
                        const py = mirror * d.ly[t.j];
                        const rx = c * px - sn * py;
                        const ry = sn * px + c * py;
                        cost += (rx - t.tx) ** 2 + (ry - t.ty) ** 2;
                    }
                    if (cost < best.cost) best = { cost, angle, mirror };
                }
                const c = Math.cos(best.angle);
                const sn = Math.sin(best.angle);
                d.nodes.forEach((_, j) => {
                    const px = d.lx[j];
                    const py = best.mirror * d.ly[j];
                    d.lx[j] = c * px - sn * py;
                    d.ly[j] = sn * px + c * py;
                });
            });
        }
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

    /**
     * Star: a stemma is almost a tree (pedigree collapse is rare — the real
     * 11k stemma has 76 independent cycles over 16k nodes), so draw a
     * spanning tree as a radial tree. Root = the tree's centroid; every
     * subtree gets an angular wedge proportional to its number of leaves
     * (wedges never overlap, so tree edges cannot cross); each depth sits on
     * a ring whose radius grows until neighbouring nodes are `starSpacing`
     * apart. Only the few non-tree edges can cross anything.
     */
    function starComponent(members: number[]) {
        if (members.length === 1) {
            x[members[0]] = 0;
            y[members[0]] = 0;
            return { r: opt.starSpacing + opt.componentGap / 2, x: 0, y: 0, members };
        }
        const memberSet = inUnit;
        for (const v of members) memberSet[v] = 1;
        const treeFrom = (root: number) => {
            const parent = new Int32Array(n).fill(-2);
            parent[root] = -1;
            const order = [root];
            const kids = new Map<number, number[]>();
            for (let h = 0; h < order.length; h++) {
                const v = order[h];
                let next = nbrs[v].filter((u) => memberSet[u] && parent[u] === -2);
                // a family's spouses first, then its children: couples side by side
                if (isFamily[v]) next = [...next.filter((u) => parentsOf[v].includes(u)), ...next.filter((u) => !parentsOf[v].includes(u))];
                const mine: number[] = [];
                for (const u of next) {
                    if (parent[u] !== -2) continue;
                    parent[u] = v;
                    order.push(u);
                    mine.push(u);
                }
                kids.set(v, mine);
            }
            return { order, kids, parent };
        };
        const subtree = (order: number[], kids: Map<number, number[]>) => {
            const size = new Map<number, number>();
            const leaves = new Map<number, number>();
            for (let h = order.length - 1; h >= 0; h--) {
                const v = order[h];
                const ks = kids.get(v) ?? [];
                size.set(v, 1 + ks.reduce((sum, k) => sum + size.get(k)!, 0));
                leaves.set(v, ks.length ? ks.reduce((sum, k) => sum + leaves.get(k)!, 0) : 1);
            }
            return { size, leaves };
        };
        const first = treeFrom(members[0]);
        const firstSize = subtree(first.order, first.kids).size;
        let root = first.order[0];
        let best = Infinity;
        for (const v of first.order) {
            let heaviest = members.length - firstSize.get(v)!;
            for (const k of first.kids.get(v) ?? []) heaviest = Math.max(heaviest, firstSize.get(k)!);
            if (heaviest < best) {
                best = heaviest;
                root = v;
            }
        }
        const { order, kids, parent } = treeFrom(root);
        for (const v of members) memberSet[v] = 0;
        const { leaves } = subtree(order, kids);
        const firstExtra = nonTreeEdges.length;
        for (const v of members) for (const u of nbrs[v]) if (u > v && parent[u] !== v && parent[v] !== u) nonTreeEdges.push(v, u);
        const depth = new Int32Array(n);
        for (const v of order) depth[v] = parent[v] < 0 ? 0 : depth[parent[v]] + 1;

        const angle = new Float64Array(n);
        const place = () => {
            const wedge0 = new Float64Array(n);
            const wedge1 = new Float64Array(n);
            wedge0[root] = 0;
            wedge1[root] = 2 * Math.PI;
            angle[root] = 0;
            for (const v of order) {
                const ks = kids.get(v) ?? [];
                if (!ks.length) continue;
                const total = ks.reduce((sum, k) => sum + leaves.get(k)!, 0);
                let cursor = wedge0[v];
                const span = wedge1[v] - wedge0[v];
                for (const k of ks) {
                    const w = (span * leaves.get(k)!) / total;
                    wedge0[k] = cursor;
                    wedge1[k] = cursor + w;
                    angle[k] = cursor + w / 2;
                    cursor += w;
                }
            }
        };
        place();

        // Crossing reduction for the non-tree edges (the few extra marriages /
        // pedigree collapses): they are drawn as chords across the star, and a
        // chord crosses every branch between its two ends. Greedy local search
        // over child orders: for each node on a path from a non-tree edge's
        // end up to the root, try reversing its children and moving each
        // involved child to every slot; keep whatever shortens the chords
        // (sum of angular distances). Each try only re-places that subtree.
        const extra: Array<[number, number]> = [];
        // this component's non-tree edges were appended from `firstExtra` on
        for (let i = firstExtra; i < nonTreeEdges.length; i += 2) extra.push([nonTreeEdges[i], nonTreeEdges[i + 1]]);
        if (opt.starOrderPasses > 0 && extra.length) {
            const wedge0 = new Float64Array(n);
            const wedge1 = new Float64Array(n);
            // re-place a subtree inside its (fixed) wedge
            const placeSubtree = (top: number) => {
                const stack = [top];
                while (stack.length) {
                    const v = stack.pop()!;
                    const ks = kids.get(v) ?? [];
                    if (!ks.length) continue;
                    const total = ks.reduce((sum, k) => sum + leaves.get(k)!, 0);
                    let cursor = wedge0[v];
                    const span = wedge1[v] - wedge0[v];
                    for (const k of ks) {
                        const w = (span * leaves.get(k)!) / total;
                        wedge0[k] = cursor;
                        wedge1[k] = cursor + w;
                        angle[k] = cursor + w / 2;
                        cursor += w;
                        stack.push(k);
                    }
                }
            };
            wedge0[root] = 0;
            wedge1[root] = 2 * Math.PI;
            placeSubtree(root);
            // which non-tree edges touch each subtree, and which nodes are on their paths
            const touching = new Map<number, number[]>();
            const onPath = new Set<number>();
            extra.forEach(([u, v], e) => {
                for (const end of [u, v]) {
                    for (let w = end; w >= 0; w = parent[w]) {
                        onPath.add(w);
                        const arr = touching.get(w) ?? touching.set(w, []).get(w)!;
                        if (arr[arr.length - 1] !== e) arr.push(e);
                    }
                }
            });
            const chord = (e: number) => {
                const d = Math.abs(angle[extra[e][0]] - angle[extra[e][1]]) % (2 * Math.PI);
                return Math.min(d, 2 * Math.PI - d);
            };
            const costOf = (es: number[]) => es.reduce((sum, e) => sum + chord(e), 0);
            const candidates = order.filter((v) => onPath.has(v) && (kids.get(v) ?? []).length > 1);
            for (let pass = 0; pass < opt.starOrderPasses; pass++) {
                let improved = false;
                for (const v of candidates) {
                    const es = touching.get(v) ?? [];
                    if (!es.length) continue;
                    const current = kids.get(v)!;
                    let bestOrder = current;
                    let bestCost = costOf(es);
                    const tryOrder = (o: number[]) => {
                        kids.set(v, o);
                        placeSubtree(v);
                        const c = costOf(es);
                        if (c < bestCost - 1e-9) {
                            bestCost = c;
                            bestOrder = o;
                        }
                    };
                    tryOrder([...current].reverse());
                    for (const k of current) {
                        if (!onPath.has(k)) continue;
                        const rest = bestOrder.filter((q) => q !== k);
                        for (let slot = 0; slot <= rest.length; slot++) tryOrder([...rest.slice(0, slot), k, ...rest.slice(slot)]);
                    }
                    kids.set(v, bestOrder);
                    placeSubtree(v);
                    if (bestOrder !== current) improved = true;
                }
                if (!improved) break;
            }
        }

        // ring radii: grow each depth until neighbours are starSpacing apart
        const byDepth: number[][] = [];
        for (const v of order) (byDepth[depth[v]] ??= []).push(v);
        const radius: number[] = [0];
        for (let d = 1; d < byDepth.length; d++) {
            const angs = byDepth[d].map((v) => angle[v]).sort((p, q) => p - q);
            let minGap = 2 * Math.PI;
            for (let i = 0; i < angs.length; i++) {
                const next = i + 1 < angs.length ? angs[i + 1] : angs[0] + 2 * Math.PI;
                if (angs.length > 1) minGap = Math.min(minGap, next - angs[i]);
            }
            const need = angs.length > 1 ? opt.starSpacing / Math.max(minGap, 1e-9) : 0;
            radius[d] = Math.max(radius[d - 1] + opt.starLevelGap, need);
        }
        let maxR = 0;
        for (const v of order) {
            const r = radius[depth[v]];
            x[v] = r * Math.cos(angle[v]);
            y[v] = r * Math.sin(angle[v]);
            maxR = Math.max(maxR, r);
        }
        return { r: maxR + opt.componentGap / 2, x: 0, y: 0, members };
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
    return { x, y, region: regionOf, nonTreeEdges };
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
        if (groups) {
            // clan regions: the seed is where every node belongs, it becomes the anchor
            d.ax = d.x;
            d.ay = d.y;
        } else {
            // star: refine freely first so long seed edges can shorten; the engines
            // anchor nodes where the layout comes to rest
            d.ax = undefined;
            d.ay = undefined;
        }
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
