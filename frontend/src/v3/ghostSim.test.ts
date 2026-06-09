import {
    GHOST_SIM_ALPHA_DECAY,
    GHOST_SIM_CENTER_STRENGTH,
    GHOST_SIM_CHARGE_STRENGTH,
    GHOST_SIM_COLLIDE_RADIUS,
    GHOST_SIM_LINK_DISTANCE,
    GHOST_SIM_LINK_STRENGTH,
    GHOST_SIM_VELOCITY_DECAY,
    buildGhostSimGraph,
    configureGhostSim,
    ghostSimNeighborDomIds,
} from "./ghostSim";
import { deriveGhostLayout } from "./ghostHelpers";
import type { Stemma } from "../model";
import { StemmaIndex } from "../stemmaIndex";
import { normalizeId } from "../graphTools";

describe("ghost sim tuning constants", () => {
    it("decay constants are heavier than the main edit-off sim defaults", () => {
        // d3 defaults: alphaDecay ≈ 0.0228, velocityDecay = 0.4. Main edit-off
        // sim uses velocityDecay 0.8. Ghost must be strictly heavier so it
        // settles inside the 300–500 ms target.
        expect(GHOST_SIM_ALPHA_DECAY).toBeGreaterThan(0.1);
        expect(GHOST_SIM_VELOCITY_DECAY).toBeGreaterThanOrEqual(0.8);
    });

    it("link force is attractive, charge force is repulsive", () => {
        expect(GHOST_SIM_LINK_DISTANCE).toBeGreaterThan(0);
        expect(GHOST_SIM_LINK_STRENGTH).toBeGreaterThan(0);
        expect(GHOST_SIM_CHARGE_STRENGTH).toBeLessThan(0);
    });

    it("centring and collide are positive", () => {
        expect(GHOST_SIM_CENTER_STRENGTH).toBeGreaterThan(0);
        expect(GHOST_SIM_COLLIDE_RADIUS).toBeGreaterThan(0);
    });
});

function isolatedStemma(): Stemma {
    return {
        type: "Stemma",
        people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
        families: [],
    };
}

function familyStemma(): Stemma {
    return {
        type: "Stemma",
        people: [
            { type: "PersonDescription", id: "p1", name: "Alice", readOnly: false },
            { type: "PersonDescription", id: "p2", name: "Bob", readOnly: false },
            { type: "PersonDescription", id: "p3", name: "Carol", readOnly: false },
            { type: "PersonDescription", id: "p4", name: "Far", readOnly: false },
        ],
        families: [
            { type: "FamilyDescription", id: "f1", parents: ["p1", "p2"], children: ["p3"], readOnly: false },
        ],
    };
}

describe("buildGhostSimGraph — neighbour selection", () => {
    it("includes focused, 1-hop neighbours, and ghosts; excludes non-neighbour real nodes", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const neighborIds = ghostSimNeighborDomIds(focused, index);
        const seed = {
            origin: { x: 0, y: 0 },
            neighborPositions: new Map([...neighborIds].map((id) => [id, { x: 0, y: 0 }])),
            ghostPositions: new Map(
                layout.persons.map((p) => [p.id, { x: p.dx, y: p.dy }]),
            ),
        };
        const graph = buildGhostSimGraph(focused, index, layout, seed);
        const ids = new Set(graph.nodes.map((n) => n.id));
        expect(ids.has(normalizeId("family", "f1"))).toBe(true);
        expect(ids.has(normalizeId("person", "p1"))).toBe(true);
        expect(ids.has(normalizeId("person", "p2"))).toBe(true);
        expect(ids.has(normalizeId("person", "p3"))).toBe(true);
        expect(ids.has(normalizeId("person", "p4"))).toBe(false);
        expect(ids.has("ghost-person-child")).toBe(true);
    });

    it("pins focused node at origin (fx/fy set)", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const seed = {
            origin: { x: 100, y: 200 },
            neighborPositions: new Map(),
            ghostPositions: new Map(layout.persons.map((p) => [p.id, { x: 100 + p.dx, y: 200 + p.dy }])),
        };
        const graph = buildGhostSimGraph(focused, index, layout, seed);
        const focusedNode = graph.nodes.find((n) => n.id === normalizeId("family", "f1"))!;
        expect(focusedNode.fx).toBe(100);
        expect(focusedNode.fy).toBe(200);
        expect(focusedNode.isGhost).toBe(false);
    });

    it("ghost nodes are unfrozen (no fx/fy)", () => {
        const index = new StemmaIndex(isolatedStemma());
        const focused = { kind: "person" as const, id: "lone" };
        const layout = deriveGhostLayout(focused, index);
        const seed = {
            origin: { x: 0, y: 0 },
            neighborPositions: new Map(),
            ghostPositions: new Map([
                ...layout.families.map((f) => [f.id, { x: f.dx, y: f.dy }] as const),
                ...layout.persons.map((p) => [p.id, { x: p.dx, y: p.dy }] as const),
            ]),
        };
        const graph = buildGhostSimGraph(focused, index, layout, seed);
        for (const n of graph.nodes) {
            if (!n.isGhost) continue;
            expect(n.fx == null).toBe(true);
            expect(n.fy == null).toBe(true);
        }
    });

    it("excludes pending entities from the neighbour set", () => {
        const stemma: Stemma = {
            type: "Stemma",
            people: [
                { type: "PersonDescription", id: "p1", name: "Alice", readOnly: false },
                { type: "PersonDescription", id: "p2", name: "Bob", readOnly: false },
            ],
            families: [
                { type: "FamilyDescription", id: "fReal", parents: ["p1", "p2"], children: [], readOnly: false },
                {
                    type: "FamilyDescription",
                    id: "pending-family-xyz",
                    parents: ["p1"],
                    children: [],
                    readOnly: true,
                },
            ],
        };
        const index = new StemmaIndex(stemma);
        const focused = { kind: "person" as const, id: "p1" };
        const ids = ghostSimNeighborDomIds(focused, index);
        expect(ids.has(normalizeId("family", "pending-family-xyz"))).toBe(false);
        expect(ids.has(normalizeId("family", "fReal"))).toBe(true);
        expect(ids.has(normalizeId("person", "p2"))).toBe(true);
    });

    it("builds real-family links among focused + neighbours", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const neighborIds = ghostSimNeighborDomIds(focused, index);
        const seed = {
            origin: { x: 0, y: 0 },
            neighborPositions: new Map([...neighborIds].map((id) => [id, { x: 0, y: 0 }])),
            ghostPositions: new Map(layout.persons.map((p) => [p.id, { x: p.dx, y: p.dy }])),
        };
        const graph = buildGhostSimGraph(focused, index, layout, seed);
        const famDom = normalizeId("family", "f1");
        const hasLink = (a: string, b: string) =>
            graph.links.some((l) => l.source === a && l.target === b);
        expect(hasLink(normalizeId("person", "p1"), famDom)).toBe(true);
        expect(hasLink(normalizeId("person", "p2"), famDom)).toBe(true);
        expect(hasLink(famDom, normalizeId("person", "p3"))).toBe(true);
    });

    it("links the focused-family ghost-child to the focused family", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const seed = {
            origin: { x: 0, y: 0 },
            neighborPositions: new Map(),
            ghostPositions: new Map(layout.persons.map((p) => [p.id, { x: p.dx, y: p.dy }])),
        };
        const graph = buildGhostSimGraph(focused, index, layout, seed);
        const famDom = normalizeId("family", "f1");
        const hasLink = (a: string, b: string) =>
            graph.links.some((l) => l.source === a && l.target === b);
        expect(hasLink(famDom, "ghost-person-child")).toBe(true);
    });
});

describe("configureGhostSim — runs to completion", () => {
    it("settles below alphaMin within ~50 ticks", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const neighborIds = ghostSimNeighborDomIds(focused, index);
        const seed = {
            origin: { x: 0, y: 0 },
            neighborPositions: new Map([...neighborIds].map((id, i) => [id, { x: i * 30, y: i * 10 }])),
            ghostPositions: new Map(layout.persons.map((p) => [p.id, { x: p.dx, y: p.dy }])),
        };
        const graph = buildGhostSimGraph(focused, index, layout, seed);
        const sim = configureGhostSim(graph, seed.origin);
        sim.stop();
        for (let i = 0; i < 50; i++) sim.tick();
        expect(sim.alpha()).toBeLessThan(0.001);
    });

    it("keeps the focused node pinned at origin throughout the sim", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const neighborIds = ghostSimNeighborDomIds(focused, index);
        const origin = { x: 50, y: 60 };
        const seed = {
            origin,
            neighborPositions: new Map([...neighborIds].map((id, i) => [id, { x: i * 30, y: i * 10 }])),
            ghostPositions: new Map(layout.persons.map((p) => [p.id, { x: p.dx, y: p.dy }])),
        };
        const graph = buildGhostSimGraph(focused, index, layout, seed);
        const sim = configureGhostSim(graph, origin);
        sim.stop();
        for (let i = 0; i < 50; i++) sim.tick();
        const focusedNode = graph.nodes.find((n) => n.id === normalizeId("family", "f1"))!;
        expect(focusedNode.x).toBe(origin.x);
        expect(focusedNode.y).toBe(origin.y);
    });

    it("spreads a real child and a ghost child so they end up well apart around the family", () => {
        // AC: "With one real child + one ghost-child under a focused family,
        // the two siblings end up at roughly opposite angles around the family."
        // Single-parent family so the symmetry isn't biased by a second parent.
        const stemma: Stemma = {
            type: "Stemma",
            people: [
                { type: "PersonDescription", id: "p1", name: "Alice", readOnly: false },
                { type: "PersonDescription", id: "p3", name: "Carol", readOnly: false },
            ],
            families: [
                { type: "FamilyDescription", id: "f1", parents: ["p1"], children: ["p3"], readOnly: false },
            ],
        };
        const index = new StemmaIndex(stemma);
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const origin = { x: 0, y: 0 };
        const childDom = normalizeId("person", "p3");
        const seed = {
            origin,
            neighborPositions: new Map([
                [normalizeId("person", "p1"), { x: 0, y: -100 }],
                [childDom, { x: 60, y: 60 }],
            ]),
            ghostPositions: new Map(layout.persons.map((p) => [p.id, { x: p.dx, y: p.dy }])),
        };
        const graph = buildGhostSimGraph(focused, index, layout, seed);
        const sim = configureGhostSim(graph, origin);
        sim.stop();
        for (let i = 0; i < 80; i++) sim.tick();
        const realChild = graph.nodes.find((n) => n.id === childDom)!;
        const ghostChild = graph.nodes.find((n) => n.id === "ghost-person-child")!;
        // Siblings end up clearly separated so the user can click either
        // without overlap. >1.5× collide-radius covers the practical case.
        const sepDist = Math.hypot(realChild.x - ghostChild.x, realChild.y - ghostChild.y);
        expect(sepDist).toBeGreaterThan(GHOST_SIM_COLLIDE_RADIUS * 1.5);
        // And the angle between them around the family is wide (≥ 45°), so
        // they sit on visibly different arcs around the family node.
        const dot = realChild.x * ghostChild.x + realChild.y * ghostChild.y;
        const magReal = Math.hypot(realChild.x, realChild.y);
        const magGhost = Math.hypot(ghostChild.x, ghostChild.y);
        expect(dot / (magReal * magGhost)).toBeLessThan(0.7);
    });
});
