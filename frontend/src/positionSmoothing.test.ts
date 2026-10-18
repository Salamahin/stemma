import { PositionSmoother } from "./positionSmoothing";

type N = { x: number; y: number; fx?: number | null; fy?: number | null };
const nodes = (): N[] => [{ x: 0, y: 0 }, { x: 100, y: 100 }];

describe("PositionSmoother", () => {
    test("glides from where nodes are drawn to the new positions over the update interval", () => {
        const ns = nodes();
        const s = new PositionSmoother();
        s.target(ns, [10, 110], [0, 100], 0);
        s.step(ns, 0);
        expect(ns[0].x).toBe(0);
        // updates every 40 ms: the glide takes about that long
        s.target(ns, [10, 110], [0, 100], 40);
        s.target(ns, [50, 150], [0, 100], 80);
        const from = ns[0].x;
        s.step(ns, 90);
        expect(ns[0].x).toBeGreaterThan(from);
        expect(ns[0].x).toBeLessThan(50);
        expect(s.step(ns, 200)).toBe(false);
        expect([ns[0].x, ns[1].x]).toEqual([50, 150]);
    });

    test("a new update mid-glide continues from the drawn position (no jump back)", () => {
        const ns = nodes();
        const s = new PositionSmoother();
        s.target(ns, [100, 100], [0, 100], 0);
        s.target(ns, [100, 100], [0, 100], 30);
        s.step(ns, 40);
        const mid = ns[0].x;
        s.target(ns, [200, 100], [0, 100], 45);
        s.step(ns, 45);
        expect(ns[0].x).toBeCloseTo(mid, 6);
    });

    test("pinned nodes (dragged, edit mode) are left to the main thread", () => {
        const ns = nodes();
        ns[0].fx = 5;
        ns[0].x = 5;
        const s = new PositionSmoother();
        s.target(ns, [77, 100], [0, 100], 0);
        s.step(ns, 1000);
        expect(ns[0].x).toBe(5);
        expect(ns[1].x).toBe(100);
    });

    test("finish jumps to the targets", () => {
        const ns = nodes();
        const s = new PositionSmoother();
        s.target(ns, [10, 20], [30, 40], 0);
        s.finish(ns);
        expect(ns.map((n) => [n.x, n.y])).toEqual([[10, 30], [20, 40]]);
        expect(s.step(ns, 5)).toBe(false);
    });
});
