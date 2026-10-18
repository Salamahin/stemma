import * as d3 from "d3";
import {
    forceCollideSized,
    createLayoutSimulation,
    LayoutLoop,
    LAYOUT_TICKS,
    LAYOUT_REFINE_ALPHA,
    LAYOUT_REHEAT_ALPHA,
    LAYOUT_SETTLE_MS,
    giveCollisionRadius,
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

/** A scheduler on a simulated clock: waiting for a frame costs 1000/60 ms, `spend` advances it by hand. */
function frameClock() {
    const queue: Array<() => void> = [];
    let t = 0;
    const scheduler = {
        soon: (fn: () => void) => queue.push(fn),
        frame: (fn: () => void) => queue.push(() => {
            t += 1000 / 60;
            fn();
        }),
        now: () => t,
    };
    return {
        scheduler,
        time: () => t,
        spend: (ms: number) => (t += ms),
        runAll: (max = 100_000) => {
            let i = 0;
            while (queue.length && i++ < max) queue.shift()!();
        },
    };
}

describe("star seed refine", () => {
    test("a fresh star seed refines without anchors and is anchored to stay where it comes to rest", () => {
        const { nodes, links } = syntheticGraph(80);
        const m = manualScheduler(1);
        let ended = 0;
        const engine = new InlineLayoutEngine([500, 400], { onTick: () => {}, onEnd: () => ended++ }, m.scheduler);
        engine.setGraph(nodes, links, 1, true, true);
        expect(nodes.every((n: any) => n.ax == null)).toBe(true);
        m.runAll();
        expect(ended).toBe(1);
        expect(nodes.every((n: any) => Number.isFinite(n.ax) && Number.isFinite(n.ay))).toBe(true);

        // a later refine (reopen) starts in equilibrium: the layout stays put
        const rest = nodes.map((n: any) => [n.x, n.y]);
        engine.setGraph(nodes, links, LAYOUT_REFINE_ALPHA, true, false);
        m.runAll();
        const drift = nodes.map((n: any, i: number) => Math.hypot(n.x - rest[i][0], n.y - rest[i][1])).sort((a, b) => a - b);
        expect(drift[Math.floor(drift.length / 2)]).toBeLessThan(10);
    });

    test("a reheat of a remembered layout keeps its anchors from the start", () => {
        const { nodes, links } = syntheticGraph(40);
        nodes.forEach((n: any, i: number) => {
            n.x = i * 10;
            n.y = i * 5;
        });
        const m = manualScheduler(1);
        const engine = new InlineLayoutEngine([500, 400], { onTick: () => {}, onEnd: () => {} }, m.scheduler);
        engine.setGraph(nodes, links, 0.3, false, false);
        expect(nodes.every((n: any) => n.ax != null)).toBe(true);
    });
});

describe("LayoutLoop", () => {
    test("a paced settle spreads the same ticks over about LAYOUT_SETTLE_MS instead of finishing at once (#307)", () => {
        const { nodes, links } = syntheticGraph(60);
        const sim = createLayoutSimulation(nodes, links, 1000, 800);
        const clock = frameClock();
        let ticks = 0;
        let endedAt = -1;
        const loop = new LayoutLoop(sim, clock.scheduler, 8, (t) => (ticks += t), () => (endedAt = clock.time()), LAYOUT_SETTLE_MS);
        loop.start();
        clock.runAll();
        expect(endedAt).toBeGreaterThan(LAYOUT_SETTLE_MS * 0.8);
        expect(endedAt).toBeLessThan(LAYOUT_SETTLE_MS * 1.3);
        expect(ticks).toBeLessThanOrEqual(LAYOUT_TICKS + 5);
    });

    test("a slow machine is not slowed down further by pacing", () => {
        const run = (settleMs: number) => {
            const { nodes, links } = syntheticGraph(60);
            const s = createLayoutSimulation(nodes, links, 1000, 800);
            const clock = frameClock();
            const tick = s.tick.bind(s);
            s.tick = ((n?: number) => {
                clock.spend(40 * (n ?? 1)); // every tick costs 40 ms: slower than the pace
                return tick(n);
            }) as typeof s.tick;
            let endedAt = -1;
            new LayoutLoop(s, clock.scheduler, 8, () => {}, () => (endedAt = clock.time()), settleMs).start();
            clock.runAll();
            return endedAt;
        };
        expect(run(LAYOUT_SETTLE_MS)).toBeLessThanOrEqual(run(0) * 1.05);
    });


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

    test("real people collide once the engine gives them a radius (no piles of nodes)", () => {
        const nodes: any[] = [
            { id: "person_a", x: 0, y: 0, ax: 0, ay: 0 },
            { id: "person_b", x: 5, y: 0, ax: 5, ay: 0 },
            { id: "family_f", x: 0, y: 3, ax: 0, ay: 3 },
        ];
        giveCollisionRadius(nodes);
        expect(nodes.map((n) => n.r)).toEqual([1, 1, 0.5]);
        const sim = createLayoutSimulation(nodes, [], 0, 0);
        for (let i = 0; i < 100; i++) sim.tick();
        expect(Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y)).toBeGreaterThan(30);
        // an explicit radius (ghost-burst neighbours) is kept
        const ghost: any = { id: "person_g", x: 0, y: 0, r: 1.5 };
        giveCollisionRadius([ghost]);
        expect(ghost.r).toBe(1.5);
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

    test("a node the user moves in edit mode stays exactly there through an edit-mode settle", () => {
        const m = manualScheduler(1);
        const engine = new InlineLayoutEngine([0, 0], { onTick: () => {}, onEnd: () => {} }, m.scheduler);
        const { nodes, links } = syntheticGraph(40);
        engine.setGraph(nodes, links, 1);
        m.runAll();
        // edit mode: everything pinned where it is
        for (const n of nodes as any[]) (n.fx = n.x), (n.fy = n.y);
        engine.syncFixed();
        const moved: any = nodes[3];
        const target = { x: moved.x + 160, y: moved.y - 120 };
        engine.moveTo(moved, target.x, target.y);
        expect([moved.x, moved.y, moved.fx, moved.fy, moved.ax, moved.ay]).toEqual([target.x, target.y, target.x, target.y, target.x, target.y]);
        engine.settle(80);
        m.runAll();
        expect([moved.x, moved.y]).toEqual([target.x, target.y]);
    });

    test("anchors changed on a running layout take effect (d3 caches force targets)", () => {
        const m = manualScheduler(1);
        const engine = new InlineLayoutEngine([0, 0], { onTick: () => {}, onEnd: () => {} }, m.scheduler);
        // two unrelated people far apart: only their anchors hold them
        const a: any = { id: "person_a", type: "person", x: 0, y: 0 };
        const b: any = { id: "person_b", type: "person", x: 5000, y: 0 };
        engine.setGraph([a, b], [], 1);
        m.runAll();
        engine.moveTo(a, 400, 300);
        engine.run({ alpha: 0.3, alphaTarget: 0 });
        m.runAll();
        expect(Math.hypot(a.x - 400, a.y - 300)).toBeLessThan(20);
        // the same for an anchor set by a drop after a view-mode drag
        a.fx = a.x = -300;
        a.fy = a.y = -300;
        a.fx = a.fy = null;
        engine.pin(a);
        engine.run({ alpha: 0.3, alphaTarget: 0 });
        m.runAll();
        expect(Math.hypot(a.x + 300, a.y + 300)).toBeLessThan(20);
    });
});
