import { GHOST_PUSH_CLEARANCE, GHOST_PUSH_REACH, NODE_SEPARATION, NeighbourPush, PushRegistry, type GhostDisc } from "./ghostPush";

type N = { id: string; x: number; y: number };
const person = (id: string, x: number, y: number): N => ({ id: `person_${id}`, x, y });
const ghost = (x: number, y: number): GhostDisc => ({ x, y, type: "ghost-person" });

function run(push: NeighbourPush<N>, ghosts: GhostDisc[], edges: Array<readonly [{ x: number; y: number }, { x: number; y: number }]> = [], ticks = 80) {
    for (let i = 0; i < ticks; i++) push.step(ghosts, edges);
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("NeighbourPush", () => {
    test("ghosts push nearby people well clear; the focused, far and pinned ones stay", () => {
        const focus = person("f", 0, 0);
        const near = person("near", 100, 0);
        const far = person("far", 110 + GHOST_PUSH_REACH + 50, 0);
        const pinned = person("pinned", 0, 100);
        const nodes = [focus, near, far, pinned];
        const copies = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, fx: n.x, fy: n.y } as any]));
        const ghosts = [ghost(110, 10), ghost(0, 110)];
        const push = new NeighbourPush(nodes, [], copies, focus.id, ghosts, new PushRegistry(), (n) => n.id === pinned.id);
        run(push, ghosts);
        expect(dist(near, ghosts[0])).toBeGreaterThan(GHOST_PUSH_CLEARANCE * 0.85);
        // the burst sim sees the moved node (its frozen copy follows)
        expect(copies.get(near.id).fx).toBe(near.x);
        expect([focus.x, focus.y, far.x, far.y, pinned.x, pinned.y]).toEqual([0, 0, 110 + GHOST_PUSH_REACH + 50, 0, 0, 100]);
    });

    test("people get off the dashed ghost edges", () => {
        const focus = person("f", 0, 0);
        const onEdge = person("on", 100, 5);
        const g = ghost(250, 0);
        const push = new NeighbourPush([focus, onEdge], [], new Map(), focus.id, [g]);
        run(push, [g], [[focus, g]]);
        expect(Math.abs(onEdge.y)).toBeGreaterThan(40);
    });

    test("a real edge running through a ghost is shifted aside with its ends", () => {
        const focus = person("f", 0, 0);
        const a = person("a", 200, -200);
        const b = person("b", 200, 200);
        const g = ghost(200, 0);
        const link = { source: a, target: b };
        const push = new NeighbourPush([focus, a, b], [link], new Map(), focus.id, [g]);
        run(push, [g]);
        // closest point of a–b to the ghost
        const t = Math.max(0, Math.min(1, ((g.x - a.x) * (b.x - a.x) + (g.y - a.y) * (b.y - a.y)) / dist(a, b) ** 2));
        const c = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        expect(dist(c, g)).toBeGreaterThan(50);
    });

    test("pushed people never pile onto each other or onto nodes that stay", () => {
        const focus = person("f", 0, 0);
        const a = person("a", 130, 0);
        const b = person("b", 200, 0);
        const c = person("c", 135, 20); // already closer than the separation to a
        const g = ghost(95, 0);
        const push = new NeighbourPush([focus, a, b, c], [], new Map(), focus.id, [g]);
        run(push, [g]);
        expect(dist(a, b)).toBeGreaterThanOrEqual(NODE_SEPARATION - 0.1);
        expect(dist(a, c)).toBeGreaterThanOrEqual(Math.hypot(5, 20) - 0.1);
        for (const n of [a, b, c]) expect(dist(n, focus)).toBeGreaterThanOrEqual(NODE_SEPARATION - 0.1);
    });

    test("without ghosts nearby nothing moves", () => {
        const focus = person("f", 0, 0);
        const near = person("near", 100, 0);
        const g = ghost(-250, -250);
        const push = new NeighbourPush([focus, near], [], new Map(), focus.id, [g]);
        run(push, [g]);
        expect([near.x, near.y]).toEqual([100, 0]);
    });
});

describe("PushRegistry", () => {
    const pushed = () => {
        const registry = new PushRegistry();
        const focus = person("f", 0, 0);
        const near = person("near", 100, 0);
        const g = ghost(110, 10);
        const push = new NeighbourPush([focus, near], [], new Map(), focus.id, [g], registry);
        run(push, [g]);
        return { registry, focus, near, push };
    };

    test("released nodes glide home and end exactly there", () => {
        const { registry, near, push } = pushed();
        expect(near.x).not.toBe(100);
        push.release();
        const first = registry.returnStep();
        expect(first).toBe(true);
        expect(near.x).not.toBe(100); // a glide, not a jump
        for (let i = 0; i < 200 && registry.returning(); i++) registry.returnStep();
        expect([near.x, near.y]).toEqual([100, 0]);
        expect(registry.returning()).toBe(false);
    });

    test("a node moved by something else meanwhile stays where it was put", () => {
        const { registry, near, push } = pushed();
        push.release();
        near.x = 999; // dragged
        registry.settle();
        expect(near.x).toBe(999);
    });

    test("a new focus during the glide pushes from home, so displacement never accumulates", () => {
        const { registry, focus, near, push } = pushed();
        push.release();
        registry.returnStep(); // half way back
        const g = ghost(-500, -500); // the next focus has no ghost near it
        const next = new NeighbourPush([focus, near], [], new Map(), focus.id, [ghost(110, 10), g], registry);
        next.release();
        registry.settle();
        expect([near.x, near.y]).toEqual([100, 0]);
    });
});
