import {
    GHOST_NODE_COLLIDE_R,
    buildGhostInjection,
    ghostSimNeighborDomIds,
    type GhostAnchors,
} from "./ghostSim";
import { deriveGhostLayout, FOCUSED_FAMILY_REF } from "./ghostHelpers";
import type { Stemma } from "./model";
import { StemmaIndex } from "./stemmaIndex";
import { normalizeId } from "./graphTools";

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

function anchorsFromLayout(focusedId: { kind: "person" | "family"; id: string }, layout: ReturnType<typeof deriveGhostLayout>, origin = { x: 0, y: 0 }): GhostAnchors {
    const familyAnchorByRef = new Map<string, { x: number; y: number }>();
    for (const f of layout.families) familyAnchorByRef.set(f.id, { x: origin.x + f.dx, y: origin.y + f.dy });
    if (focusedId.kind === "family") familyAnchorByRef.set(FOCUSED_FAMILY_REF, origin);
    const personPositionById = new Map<string, { x: number; y: number }>();
    for (const p of layout.persons) {
        const base = familyAnchorByRef.get(p.familyId) ?? origin;
        personPositionById.set(p.id, { x: base.x + p.dx, y: base.y + p.dy });
    }
    return { origin, familyAnchorByRef, personPositionById };
}

describe("buildGhostInjection", () => {
    it("emits ghost-family + ghost-person extras for a focused isolated person", () => {
        const stemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(stemma);
        const focused = { kind: "person" as const, id: "lone" };
        const layout = deriveGhostLayout(focused, index);
        const injection = buildGhostInjection(focused, layout, anchorsFromLayout(focused, layout));

        const nodeIds = new Set(injection.extraNodes.map((n) => n.id));
        expect(nodeIds.has("ghost-family-east")).toBe(true);
        expect(nodeIds.has("ghost-family-parent")).toBe(true);
        expect(nodeIds.has("ghost-person-spouse")).toBe(true);
        expect(nodeIds.has("ghost-person-child")).toBe(true);
        expect(nodeIds.has("ghost-person-parent")).toBe(true);

        for (const n of injection.extraNodes) {
            expect(n.r).toBe(GHOST_NODE_COLLIDE_R);
            expect(n.type === "ghost-family" || n.type === "ghost-person").toBe(true);
        }
    });

    it("focused-family case yields only the ghost-child person and links it to the focused dom-id", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const injection = buildGhostInjection(focused, layout, anchorsFromLayout(focused, layout));

        expect(injection.extraNodes.map((n) => n.id)).toEqual(["ghost-person-child"]);
        const famDom = normalizeId("family", "f1");
        const hasLink = (a: string, b: string) =>
            injection.extraLinks.some((l) => l.source === a && l.target === b);
        expect(hasLink(famDom, "ghost-person-child")).toBe(true);
    });

    it("anchorEdges emit focusToFamily and familyToPerson links with correct direction", () => {
        const stemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(stemma);
        const focused = { kind: "person" as const, id: "lone" };
        const layout = deriveGhostLayout(focused, index);
        const injection = buildGhostInjection(focused, layout, anchorsFromLayout(focused, layout));

        const personDom = normalizeId("person", "lone");
        const east = injection.extraLinks.find((l) => l.source === personDom && l.target === "ghost-family-east");
        expect(east?.edgeKind).toBe("focusToFamily");

        const parent = injection.extraLinks.find((l) => l.source === "ghost-family-parent" && l.target === personDom);
        expect(parent?.edgeKind).toBe("familyToPerson");
    });

    it("ghost-person anchorSimId resolves the focused-family ref to the focused dom-id", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const layout = deriveGhostLayout(focused, index);
        const injection = buildGhostInjection(focused, layout, anchorsFromLayout(focused, layout));
        const child = injection.extraNodes.find((n) => n.id === "ghost-person-child")!;
        expect(child.anchorSimId).toBe(normalizeId("family", "f1"));
    });
});

describe("ghostSimNeighborDomIds", () => {
    it("returns 1-hop neighbour dom-ids of a focused family", () => {
        const index = new StemmaIndex(familyStemma());
        const focused = { kind: "family" as const, id: "f1" };
        const ids = ghostSimNeighborDomIds(focused, index);
        expect(ids.has(normalizeId("person", "p1"))).toBe(true);
        expect(ids.has(normalizeId("person", "p2"))).toBe(true);
        expect(ids.has(normalizeId("person", "p3"))).toBe(true);
        expect(ids.has(normalizeId("person", "p4"))).toBe(false);
    });

    it("excludes pending entities", () => {
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
});
