import { structuredLayout } from "./structuredLayout";
import { createLayoutSimulation } from "./layoutCore";
import { syntheticGraph } from "./layoutTestFixtures";

function indexed(nodes: any[], links: any[]) {
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const pairs: number[] = [];
    for (const l of links) pairs.push(idx.get(l.source)!, idx.get(l.target)!);
    return { ids: nodes.map((n) => n.id), links: Int32Array.from(pairs), idx };
}

function crossings(nodes: any[], links: any[]) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const segs = links.map((l: any) => {
        const a = byId.get(typeof l.source === "string" ? l.source : l.source.id);
        const b = byId.get(typeof l.target === "string" ? l.target : l.target.id);
        return { s: a.id, t: b.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    });
    const o = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    let c = 0;
    for (let i = 0; i < segs.length; i++)
        for (let j = i + 1; j < segs.length; j++) {
            const p = segs[i];
            const q = segs[j];
            if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) continue;
            if (o(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1) * o(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2) < 0 && o(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1) * o(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2) < 0) c++;
        }
    return c;
}

describe("structuredLayout", () => {
    test("places every node at a finite position, deterministically", () => {
        const { nodes, links } = syntheticGraph(200);
        const input = { ...indexed(nodes, links), center: [500, 400] as [number, number] };
        const a = structuredLayout(input);
        const b = structuredLayout(input);
        expect(Array.from(a.x).every(Number.isFinite)).toBe(true);
        expect(Array.from(a.y).every(Number.isFinite)).toBe(true);
        expect(Array.from(a.x)).toEqual(Array.from(b.x));
    });

    test("generations sit on rings: a child is further from its component centre than its parents", () => {
        // two parents -> family -> child -> (with spouse) family -> grandchild
        const ids = ["person_a", "person_b", "family_f", "person_c", "person_s", "family_g", "person_d"];
        const links = Int32Array.from([0, 2, 1, 2, 2, 3, 3, 5, 4, 5, 5, 6]);
        const { x, y } = structuredLayout({ ids, links, center: [0, 0] });
        const cx = x.reduce((s, v) => s + v, 0) / x.length;
        const cy = y.reduce((s, v) => s + v, 0) / y.length;
        const r = (i: number) => Math.hypot(x[i] - cx, y[i] - cy);
        // married-in spouse s shares c's generation
        expect(Math.abs(r(4) - r(3))).toBeLessThan(1e-6);
        expect(r(3)).toBeGreaterThan(r(0));
        expect(r(6)).toBeGreaterThan(r(3));
    });

    test("disconnected components do not overlap", () => {
        // one connected family each: two parents, a family, 12 children
        const family = (tag: string) => {
            const nodes = [{ id: `person_${tag}m` }, { id: `person_${tag}f` }, { id: `family_${tag}` }];
            const links = [
                { source: `person_${tag}m`, target: `family_${tag}` },
                { source: `person_${tag}f`, target: `family_${tag}` },
            ];
            for (let i = 0; i < 12; i++) {
                nodes.push({ id: `person_${tag}c${i}` });
                links.push({ source: `family_${tag}`, target: `person_${tag}c${i}` });
            }
            return { nodes, links };
        };
        const a = family("a");
        const b = family("b");
        const nodes = [...a.nodes, ...b.nodes];
        const links = [...a.links, ...b.links];
        const { ids, links: pairs } = indexed(nodes, links);
        const { x, y } = structuredLayout({ ids, links: pairs, center: [0, 0] });
        const box = (from: number, to: number) => {
            const xs = Array.from(x.slice(from, to));
            const ys = Array.from(y.slice(from, to));
            return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, r: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 };
        };
        const A = box(0, a.nodes.length);
        const B = box(a.nodes.length, nodes.length);
        expect(Math.hypot(A.cx - B.cx, A.cy - B.cy)).toBeGreaterThan(Math.max(A.r, B.r));
    });

    test("isolated people and empty input are fine", () => {
        expect(structuredLayout({ ids: [], links: new Int32Array(), center: [0, 0] }).x.length).toBe(0);
        const r = structuredLayout({ ids: ["person_x", "person_y"], links: new Int32Array(), center: [10, 10] });
        expect(Math.hypot(r.x[0] - r.x[1], r.y[0] - r.y[1])).toBeGreaterThan(30);
    });

    test("after the force refine it has far fewer crossings than the generational-row seed", () => {
        const run = (seed: "rows" | "structured") => {
            const { nodes, links } = syntheticGraph(400);
            if (seed === "structured") {
                const { ids, links: pairs } = indexed(nodes, links);
                const { x, y } = structuredLayout({ ids, links: pairs, center: [500, 400] });
                nodes.forEach((n: any, i: number) => {
                    n.x = x[i];
                    n.y = y[i];
                });
            }
            const sim = createLayoutSimulation(nodes, links, 1000, 800);
            while (sim.alpha() >= sim.alphaMin()) sim.tick();
            return crossings(nodes, links);
        };
        const rows = run("rows");
        const structured = run("structured");
        expect(structured).toBeLessThan(rows * 0.6);
    });
});
