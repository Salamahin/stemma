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
import { packSiblings } from "d3";

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
};

// Tuned with e2e/bench/seedExperiment.mjs: the seed is somewhat denser than
// the force equilibrium so the refine expands it instead of folding it.
const DEFAULTS: Required<StructuredLayoutOptions> = {
    personSpacing: 50,
    familySpacing: 20,
    generationGap: 110,
    sweeps: 4,
    componentGap: 150,
};

export type StructuredLayoutInput = {
    /** Node ids; families start with "family_", everything else is a person. */
    ids: ReadonlyArray<string>;
    /** Flattened [source, target] index pairs: person→family (parent), family→person (child). */
    links: ArrayLike<number>;
    center: [number, number];
};

export function structuredLayout(input: StructuredLayoutInput, options: StructuredLayoutOptions = {}): { x: Float64Array; y: Float64Array } {
    const opt = { ...DEFAULTS, ...options };
    const n = input.ids.length;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    if (n === 0) return { x, y };
    const isFamily = new Uint8Array(n);
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
        circles.push(layoutComponent(members));
    }

    function layoutComponent(members: number[]) {
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
                for (let k = nbrs[v].length - 1; k >= 0; k--) if (!seen.has(nbrs[v][k])) stack.push(nbrs[v][k]);
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
                    if (p !== v && layer[p] === layer[v]) {
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

    // --- pack components ----------------------------------------------------------
    circles.sort((a, b) => b.r - a.r);
    packSiblings(circles as any);
    for (const c of circles) {
        for (const v of c.members) {
            x[v] += c.x + input.center[0];
            y[v] += c.y + input.center[1];
        }
    }
    return { x, y };
}

/**
 * Moves every node that is not fixed (fx/fy) to its structured-layout
 * position and zeroes its velocity. `links` are [source, target] index pairs.
 */
export function applyStructuredSeed(
    nodes: Array<{ id: string; x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null }>,
    links: ArrayLike<number>,
    center: [number, number],
) {
    const { x, y } = structuredLayout({ ids: nodes.map((d) => d.id), links, center });
    nodes.forEach((d, i) => {
        if (d.fx == null) d.x = x[i];
        if (d.fy == null) d.y = y[i];
        d.vx = 0;
        d.vy = 0;
    });
}
