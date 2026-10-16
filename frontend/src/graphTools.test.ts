import * as d3 from "d3";
import { forceCollideSized, configureSimulation, updateSimulation, LAYOUT_TICKS, makeNodesAndRelations } from "./graphTools";

function syntheticGraph(target: number) {
    let s = 7;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const people: any[] = [];
    const families: any[] = [];
    const queue: string[] = [];
    const mk = () => {
        const id = `p${people.length}`;
        people.push({ id, name: id });
        return id;
    };
    for (let i = 0; i < 3; i++) queue.push(mk());
    while (people.length < target && queue.length) {
        const p = queue.shift()!;
        const spouse = mk();
        const kids: string[] = [];
        const n = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < n && people.length < target; k++) {
            const c = mk();
            kids.push(c);
            queue.push(c);
        }
        families.push({ id: `f${families.length}`, parents: [p, spouse], children: kids });
    }
    const [nodes, links] = makeNodesAndRelations(people, families) as [any[], any[]];
    nodes.forEach((n, i) => {
        n.x = (i % 30) * 160;
        n.y = Math.floor(i / 30) * 200;
    });
    return { nodes, links };
}

describe("layout simulation settles", () => {
    test("a fresh layout ends within the tick budget (no self-sustaining alphaTarget)", () => {
        const { nodes, links } = syntheticGraph(120);
        const sim = configureSimulation(nodes, links, 1000, 800);
        sim.stop();
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
        const sim = configureSimulation(nodes, links, 1000, 800);
        updateSimulation(sim, nodes, links);
        sim.stop();
        expect(sim.alphaTarget()).toBe(0);
        expect(sim.alpha()).toBeGreaterThan(0);
    });

    test("burst runs extra ticks inside one timer tick when allowed", () => {
        const { nodes, links } = syntheticGraph(60);
        let ticksSeen = 0;
        const sim = configureSimulation(nodes, links, 1000, 800, () => ticksSeen++, undefined, () => true);
        sim.stop();
        const before = sim.alpha();
        // One timer-driven tick (what d3's timer does each frame).
        (sim as any).tick();
        (sim as any).on("tick")();
        expect(ticksSeen).toBe(1);
        // the tick listener spent its frame budget on extra iterations
        expect(sim.alpha()).toBeLessThan(before * Math.pow(1 - sim.alphaDecay(), 2));
    });
});

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
        const sim = d3.forceSimulation(nodes).force("collide", forceCollideSized((d: any) => d.r * 20)).stop();
        sim.tick(5);
        expect(nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    });
});
