import * as d3 from "d3";
import {
    forceCollideSized,
    createLayoutSimulation,
    LayoutLoop,
    LAYOUT_TICKS,
    LAYOUT_REFINE_ALPHA,
    LAYOUT_REHEAT_ALPHA,
} from "./layoutCore";
import { InlineLayoutEngine } from "./layoutEngine";
import { syntheticGraph, manualScheduler } from "./layoutTestFixtures";

describe("forceCollideSized", () => {
    test("ignores datums without r (no NaN radii, no effect on them)", () => {
        const a: any = { x: 0, y: 0, vx: 0, vy: 0 };
        const b: any = { x: 1, y: 0, vx: 0, vy: 0 };
        const force = forceCollideSized((d: any) => d.r * 20);
        force.initialize([a, b], Math.random);
        force(1);
        expect(a.vx).toBe(0);
        expect(b.vx).toBe(0);
    });

    test("separates datums that both carry r", () => {
        const a: any = { index: 0, x: 0, y: 0, vx: 0, vy: 0, r: 1 };
        const b: any = { index: 1, x: 5, y: 0, vx: 0, vy: 0, r: 1 };
        const force = forceCollideSized((d: any) => d.r * 20);
        force.initialize([a, b], Math.random);
        force(1);
        expect(a.vx).toBeLessThan(0);
        expect(b.vx).toBeGreaterThan(0);
    });

    test("a sized ghost does not collide with unsized real nodes", () => {
        const real: any = { index: 0, x: 0, y: 0, vx: 0, vy: 0 };
        const ghost: any = { index: 1, x: 10, y: 0, vx: 0, vy: 0, r: 4 };
        const force = forceCollideSized((d: any) => d.r * 20);
        force.initialize([real, ghost], Math.random);
        force(1);
        expect(ghost.vx).toBe(0);
    });

    test("works inside a d3 simulation", () => {
        const nodes: any[] = d3.range(50).map((i) => ({ x: i, y: 0 }));
        const sim = d3.forceSimulation(nodes).force("collide", forceCollideSized((d: any) => d.r * 20) as any).stop();
        sim.tick(5);
        expect(nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    });
});

describe("layout simulation settles", () => {
    test("a fresh layout ends within the tick budget (no self-sustaining alphaTarget)", () => {
        const { nodes, links } = syntheticGraph(120);
        const sim = createLayoutSimulation(nodes, links, 1000, 800);
        expect(sim.alphaTarget()).toBe(0);
        let ticks = 0;
        while (sim.alpha() >= sim.alphaMin() && ticks < 10_000) {
            sim.tick();
            ticks++;
        }
        expect(ticks).toBeLessThanOrEqual(LAYOUT_TICKS + 5);
    });

    test("a data update reheats without leaving a permanent alphaTarget", () => {
        const { nodes, links } = syntheticGraph(60);
        const m = manualScheduler();
        const engine = new InlineLayoutEngine([500, 400], { onTick: () => {}, onEnd: () => {} }, m.scheduler);
        engine.setGraph(nodes, links, 1);
        m.runAll();
        engine.setGraph(nodes, links, LAYOUT_REHEAT_ALPHA);
        const sim = engine.simulation()!;
        expect(sim.alphaTarget()).toBe(0);
        expect(sim.alpha()).toBe(LAYOUT_REHEAT_ALPHA);
        expect(engine.isRunning()).toBe(true);
    });

    test("a refine from a remembered layout is short and barely moves settled nodes", () => {
        const { nodes, links } = syntheticGraph(120);
        const sim = createLayoutSimulation(nodes, links, 1000, 800);
        while (sim.alpha() >= sim.alphaMin()) sim.tick();
        const before = nodes.map((n: any) => [n.x, n.y]);
        nodes.forEach((n: any) => {
            n.vx = 0;
            n.vy = 0;
        });
        sim.alpha(LAYOUT_REFINE_ALPHA);
        let ticks = 0;
        while (sim.alpha() >= sim.alphaMin()) {
            sim.tick();
            ticks++;
        }
        expect(ticks).toBeLessThan(LAYOUT_TICKS * 0.7);
        const moved = nodes.map((n: any, i: number) => Math.hypot(n.x - before[i][0], n.y - before[i][1])).sort((a: number, b: number) => a - b);
        expect(moved[Math.floor(moved.length / 2)]).toBeLessThan(20);
    });
});

describe("LayoutLoop", () => {
    test("settling runs extra ticks inside one batch, within the time budget", () => {
        const { nodes, links } = syntheticGraph(60);
        const sim = createLayoutSimulation(nodes, links, 1000, 800);
        const m = manualScheduler(1); // every now() advances 1 ms
        const batches: number[] = [];
        const loop = new LayoutLoop(sim, m.scheduler, 8, (t) => batches.push(t), () => {});
        loop.start();
        m.runOne();
        expect(batches).toEqual([8]);
        expect(sim.alpha()).toBeLessThan(Math.pow(1 - sim.alphaDecay(), 2));
    });

    test("an interactive sim (alphaTarget > 0, e.g. drag) ticks once per frame and keeps running", () => {
        const { nodes, links } = syntheticGraph(30);
        const sim = createLayoutSimulation(nodes, links, 1000, 800).alphaTarget(0.3);
        const m = manualScheduler(1);
        const batches: number[] = [];
        let ended = false;
        const loop = new LayoutLoop(sim, m.scheduler, 8, (t) => batches.push(t), () => (ended = true));
        loop.start();
        for (let i = 0; i < 50; i++) m.runOne();
        expect(batches.every((t) => t === 1)).toBe(true);
        expect(batches.length).toBe(50);
        expect(ended).toBe(false);
    });

    test("ends exactly once and stops scheduling", () => {
        const { nodes, links } = syntheticGraph(30);
        const sim = createLayoutSimulation(nodes, links, 1000, 800);
        const m = manualScheduler(0.5);
        let ends = 0;
        const loop = new LayoutLoop(sim, m.scheduler, 8, () => {}, () => ends++);
        loop.start();
        m.runAll();
        expect(ends).toBe(1);
        expect(loop.isRunning).toBe(false);
        expect(m.pending()).toBe(0);
    });

    test("stop cancels pending batches; settle runs N ticks synchronously", () => {
        const { nodes, links } = syntheticGraph(30);
        const sim = createLayoutSimulation(nodes, links, 1000, 800);
        const m = manualScheduler(1);
        const batches: number[] = [];
        const loop = new LayoutLoop(sim, m.scheduler, 8, (t) => batches.push(t), () => {});
        loop.start();
        loop.stop();
        m.runAll();
        expect(batches).toEqual([]);
        loop.settle(80);
        expect(batches).toEqual([80]);
        expect(loop.isRunning).toBe(false);
    });
});

describe("anchors and clan regions in the layout forces", () => {
    const pair = (regionA?: number, regionB?: number) => {
        const a: any = { id: "person_a", x: 0, y: 0, region: regionA };
        const b: any = { id: "family_b", x: 1000, y: 0, region: regionB };
        const sim = createLayoutSimulation([a, b], [{ source: "person_a", target: "family_b" }], 0, 0);
        sim.alpha(1).tick();
        return Math.abs(a.x); // how far the link dragged `a` towards `b`
    };

    test("links across clan regions pull far more weakly than links inside one", () => {
        const inside = pair(1, 1);
        const across = pair(1, 2);
        expect(across).toBeLessThan(inside / 20);
    });

    test("an anchored node is pulled to its anchor, not to the viewport centre", () => {
        const lone: any = { id: "person_x", x: 5000, y: 5000, ax: 5000, ay: 5000 };
        const free: any = { id: "person_y", x: -5000, y: -5000 };
        const sim = createLayoutSimulation([lone, free], [], 0, 0);
        for (let i = 0; i < 50; i++) sim.tick();
        // the free node drifts towards the centre (0,0); the anchored one stays home
        expect(Math.hypot(free.x, free.y)).toBeLessThan(Math.hypot(5000, 5000) * 0.9);
        expect(Math.hypot(lone.x - 5000, lone.y - 5000)).toBeLessThan(Math.hypot(free.x + 5000, free.y + 5000));
    });

    test("engines anchor nodes where they start; anchors stay put when the layout comes to rest", () => {
        const m = manualScheduler(1);
        const engine = new InlineLayoutEngine([0, 0], { onTick: () => {}, onEnd: () => {} }, m.scheduler);
        const { nodes, links } = syntheticGraph(40);
        const start = nodes.map((n: any) => [n.x, n.y]);
        engine.setGraph(nodes, links, 1);
        expect(nodes.every((n: any, i: number) => n.ax === start[i][0] && n.ay === start[i][1])).toBe(true);
        m.runAll();
        expect(engine.isRunning()).toBe(false);
        expect(nodes.every((n: any, i: number) => n.ax === start[i][0] && n.ay === start[i][1])).toBe(true);
        // a remembered anchor is kept as is
        const kept: any = nodes[1];
        kept.ax = 4242;
        kept.ay = 2424;
        engine.setGraph(nodes, links, 0.02);
        expect([kept.ax, kept.ay]).toEqual([4242, 2424]);
        // a node released after a drag stays where it was dropped
        const dragged: any = nodes[0];
        dragged.fx = dragged.x = 777;
        dragged.fy = dragged.y = 888;
        dragged.fx = null;
        dragged.fy = null;
        engine.pin(dragged);
        expect([dragged.ax, dragged.ay]).toEqual([777, 888]);
    });
});
