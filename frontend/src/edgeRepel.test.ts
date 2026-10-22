import * as d3 from "d3";
import { forceEdgeRepel, EDGE_CLEARANCE } from "./edgeRepel";

type N = { id: string; x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };

function run(nodes: N[], links: { source: string; target: string }[], ticks = 30) {
    const force = forceEdgeRepel(links as any);
    force.initialize(nodes as any);
    for (let i = 0; i < ticks; i++) {
        for (const n of nodes) { n.vx = 0; n.vy = 0; }
        force(1);
        for (const n of nodes) {
            if (n.fx == null) n.x += n.vx!;
            if (n.fy == null) n.y += n.vy!;
        }
    }
}

function distanceToSegment(p: N, a: N, b: N) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe("forceEdgeRepel", () => {
    test("a node lying on someone else's edge is pushed off it", () => {
        const a = { id: "a", x: 0, y: 0 }, b = { id: "b", x: 300, y: 0 }, c = { id: "c", x: 150, y: 3 };
        run([a, b, c], [{ source: "a", target: "b" }]);
        expect(distanceToSegment(c, a, b)).toBeGreaterThanOrEqual(EDGE_CLEARANCE - 1);
        expect(c.y).toBeGreaterThan(0); // pushed to the side it was already on
    });

    test("the edge gives way too", () => {
        const a = { id: "a", x: 0, y: 0 }, b = { id: "b", x: 300, y: 0 }, c = { id: "c", x: 150, y: 3, fx: 150, fy: 3 };
        run([a, b, c], [{ source: "a", target: "b" }]);
        expect(a.y).toBeLessThan(0);
        expect(b.y).toBeLessThan(0);
        expect(distanceToSegment(c, a, b)).toBeGreaterThanOrEqual(EDGE_CLEARANCE - 1);
    });

    test("a node's own edges and far-away edges leave it alone", () => {
        const hub = { id: "hub", x: 0, y: 0 }, kid = { id: "kid", x: 80, y: 0 }, far = { id: "far", x: 150, y: 400 };
        const other = { id: "other", x: 0, y: 500 };
        run([hub, kid, far, other], [{ source: "hub", target: "kid" }, { source: "far", target: "other" }]);
        expect(kid).toMatchObject({ x: 80, y: 0 });
        expect(far).toMatchObject({ x: 150, y: 400 });
    });

    test("children of one family on top of a sibling's edge spread apart", () => {
        // Two children of the same family, the near one sitting on the edge to the far one.
        const fam = { id: "fam", x: 0, y: 0, fx: 0, fy: 0 };
        const near = { id: "near", x: 85, y: 0 }, farKid = { id: "farKid", x: 250, y: 2 };
        run([fam, near, farKid], [{ source: "fam", target: "near" }, { source: "fam", target: "farKid" }]);
        expect(distanceToSegment(near, fam, farKid)).toBeGreaterThanOrEqual(EDGE_CLEARANCE - 1);
    });

    test("does nothing while disabled", () => {
        const a = { id: "a", x: 0, y: 0 }, b = { id: "b", x: 300, y: 0 }, c = { id: "c", x: 150, y: 3 };
        const force = forceEdgeRepel([{ source: "a", target: "b" }] as any);
        force.initialize([a, b, c] as any);
        force.enabled(false);
        force(1);
        expect(c).toMatchObject({ vx: 0, vy: 0 });
        expect(force.enabled()).toBe(false);
    });

    test("runs inside a d3 simulation", () => {
        const nodes: N[] = [{ id: "a", x: 0, y: 0 }, { id: "b", x: 300, y: 0 }, { id: "c", x: 150, y: 1 }];
        const links = [{ source: "a", target: "b" }];
        const sim = d3.forceSimulation(nodes as any).force("link", d3.forceLink(links as any).id((n: any) => n.id)).force("edges", forceEdgeRepel(links as any)).stop();
        sim.tick(100);
        expect(distanceToSegment(nodes[2], nodes[0], nodes[1])).toBeGreaterThan(EDGE_CLEARANCE * 0.8);
    });
});
