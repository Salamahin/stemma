import { createLayoutEngine, InlineLayoutEngine, WorkerLayoutEngine } from "./layoutEngine";
import { LayoutWorkerHost } from "./layoutWorkerHost";
import type { LayoutWorkerRequest, LayoutWorkerResponse } from "./layoutProtocol";
import { syntheticGraph, manualScheduler } from "./layoutTestFixtures";

/**
 * In-process stand-in for a Worker: messages go through structuredClone-like
 * copies to a LayoutWorkerHost driven by a manual scheduler.
 */
class FakeWorker {
    onmessage: ((e: MessageEvent<LayoutWorkerResponse>) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    terminated = false;
    readonly sched = manualScheduler(1);
    readonly host = new LayoutWorkerHost((msg) => this.onmessage?.({ data: msg } as MessageEvent<LayoutWorkerResponse>), this.sched.scheduler);
    readonly sent: LayoutWorkerRequest[] = [];

    postMessage(msg: LayoutWorkerRequest) {
        if (this.terminated) return;
        this.sent.push(msg);
        this.host.handle(msg);
    }

    terminate() {
        this.terminated = true;
    }

    crash(message: string) {
        this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
    }
}

function makeEngine() {
    const fake = new FakeWorker();
    const events = { ticks: 0, ends: 0 };
    const engine = new WorkerLayoutEngine([500, 400], { onTick: () => events.ticks++, onEnd: () => events.ends++ }, fake as unknown as Worker);
    return { fake, engine, events };
}

describe("WorkerLayoutEngine", () => {
    test("lays the graph out in the worker and writes positions into the caller's nodes", () => {
        const { fake, engine, events } = makeEngine();
        const { nodes, links } = syntheticGraph(80);
        const start = nodes.map((n: any) => [n.x, n.y]);
        engine.setGraph(nodes, links, 1);
        expect(engine.isRunning()).toBe(true);
        fake.sched.runAll();
        expect(events.ticks).toBeGreaterThan(0);
        expect(events.ends).toBe(1);
        expect(engine.isRunning()).toBe(false);
        const moved = nodes.filter((n: any, i: number) => n.x !== start[i][0] || n.y !== start[i][1]).length;
        expect(moved).toBeGreaterThan(nodes.length / 2);
        expect(nodes.every((n: any) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    });

    test("nodes fixed on the main thread are neither moved by the worker nor overwritten", () => {
        const { fake, engine } = makeEngine();
        const { nodes, links } = syntheticGraph(40);
        const pinned: any = nodes[0];
        pinned.fx = 123;
        pinned.fy = 456;
        pinned.x = 123;
        pinned.y = 456;
        engine.setGraph(nodes, links, 1);
        fake.sched.runAll();
        expect([pinned.x, pinned.y]).toEqual([123, 456]);
    });

    test("drag: pin updates reach the worker; an interactive run keeps going until released", () => {
        const { fake, engine, events } = makeEngine();
        const { nodes, links } = syntheticGraph(40);
        engine.setGraph(nodes, links, 1);
        fake.sched.runAll();
        const dragged: any = nodes[3];
        engine.run({ alphaTarget: 0.3 });
        dragged.fx = 999;
        dragged.fy = -999;
        engine.pin(dragged);
        for (let i = 0; i < 20; i++) fake.sched.runOne();
        expect(engine.isRunning()).toBe(true);
        expect(events.ends).toBe(1);
        const neighbour: any = (links as any[]).find((l) => l.source === dragged.id || l.target === dragged.id);
        expect(neighbour).toBeDefined();
        engine.run({ alphaTarget: 0 });
        fake.sched.runAll();
        expect(events.ends).toBe(2);
    });

    test("syncFixed and settle: edit mode places only new nodes", () => {
        const { fake, engine, events } = makeEngine();
        const { nodes, links } = syntheticGraph(40);
        engine.setGraph(nodes, links, 1);
        fake.sched.runAll();
        const fresh: any = nodes[nodes.length - 1];
        nodes.forEach((n: any) => {
            if (n !== fresh) {
                n.fx = n.x;
                n.fy = n.y;
            }
        });
        fresh.x += 500;
        const pinnedBefore = nodes.filter((n: any) => n !== fresh).map((n: any) => [n.x, n.y]);
        const freshBefore = [fresh.x, fresh.y];
        engine.setGraph(nodes, links, 0.3, false);
        expect(engine.isRunning()).toBe(false);
        engine.settle(80);
        expect(engine.isRunning()).toBe(false);
        // the settle ran synchronously in the worker and reported back
        expect(Math.hypot(fresh.x - freshBefore[0], fresh.y - freshBefore[1])).toBeGreaterThan(1);
        const ticksAfterSettle = events.ticks;
        fake.sched.runAll(); // cancelled batches must not run
        expect(events.ticks).toBe(ticksAfterSettle);
        expect(nodes.filter((n: any) => n !== fresh).map((n: any) => [n.x, n.y])).toEqual(pinnedBefore);
    });

    test("stale replies from an older graph are ignored", () => {
        const { fake, engine } = makeEngine();
        const a = syntheticGraph(30);
        const b = syntheticGraph(30);
        engine.setGraph(a.nodes, a.links, 1);
        const before = a.nodes.map((n: any) => n.x);
        engine.setGraph(b.nodes, b.links, 1);
        fake.sched.runAll();
        expect(a.nodes.map((n: any) => n.x)).toEqual(before);
    });

    test("a worker failure falls back to the main thread and keeps laying out", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        try {
            const { fake, engine, events } = makeEngine();
            const { nodes, links } = syntheticGraph(40);
            engine.setGraph(nodes, links, 1);
            fake.crash("boom");
            expect(fake.terminated).toBe(true);
            expect(engine.isRunning()).toBe(true);
            // the inline fallback drives the very same node objects
            const sim = (engine as any).fallback.simulation();
            expect(sim.nodes()).toBe(nodes);
            while (sim.alpha() >= sim.alphaMin()) sim.tick();
            expect(nodes.every((n: any) => Number.isFinite(n.x))).toBe(true);
            expect(events.ends).toBe(0);
        } finally {
            warn.mockRestore();
        }
    });
});

describe("structured seed on cold start", () => {
    test("worker engine: seeded positions arrive before any refine tick; pinned nodes keep theirs", () => {
        const fake = new FakeWorker();
        const ticks: number[] = [];
        const engine = new WorkerLayoutEngine([500, 400], { onTick: (t) => ticks.push(t), onEnd: () => {} }, fake as unknown as Worker);
        const { nodes, links } = syntheticGraph(80);
        nodes.forEach((n: any) => {
            n.x = 500;
            n.y = 400; // everyone stacked, like an uncached stemma
        });
        const pinned: any = nodes[5];
        pinned.fx = pinned.x = 42;
        pinned.fy = pinned.y = 43;
        engine.setGraph(nodes, links, 1, true, true);
        expect(ticks[0]).toBe(0); // the seed itself, posted synchronously by the host
        const spread = new Set(nodes.map((n: any) => `${Math.round(n.x)}:${Math.round(n.y)}`)).size;
        expect(spread).toBeGreaterThan(nodes.length * 0.9);
        expect([pinned.x, pinned.y]).toEqual([42, 43]);
    });

    test("inline engine seeds synchronously too", () => {
        const ticks: number[] = [];
        const m = manualScheduler();
        const engine = new InlineLayoutEngine([500, 400], { onTick: (t) => ticks.push(t), onEnd: () => {} }, m.scheduler);
        const { nodes, links } = syntheticGraph(50);
        nodes.forEach((n: any) => {
            n.x = 0;
            n.y = 0;
        });
        engine.setGraph(nodes, links, 1, true, true);
        expect(ticks).toEqual([0]);
        expect(new Set(nodes.map((n: any) => `${n.x}:${n.y}`)).size).toBe(nodes.length);
    });
});

describe("LayoutWorkerHost", () => {
    test("reports thrown errors instead of dying silently", () => {
        const out: LayoutWorkerResponse[] = [];
        const host = new LayoutWorkerHost((m) => out.push(m), manualScheduler().scheduler);
        host.handle({ type: "graph", gen: 1, ids: ["a"], x: null as any, y: null as any, vx: null as any, vy: null as any, fx: null as any, fy: null as any, links: new Int32Array(), width: 1, height: 1, alpha: 1, start: true, seed: false, groups: new Int32Array(), ax: new Float64Array(), ay: new Float64Array() });
        expect(out[0].type).toBe("error");
    });
});

describe("createLayoutEngine", () => {
    test("without Worker support it lays out on the main thread", () => {
        expect(typeof (globalThis as any).Worker).toBe("undefined");
        const engine = createLayoutEngine([500, 400], { onTick: () => {}, onEnd: () => {} }, "/* worker */");
        expect(engine).toBeInstanceOf(InlineLayoutEngine);
        expect(engine.kind).toBe("inline");
    });
});
