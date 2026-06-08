import { deriveGhostLayout, FOCUSED_FAMILY_REF } from "./ghostHelpers";
import type { Stemma } from "../model";
import { StemmaIndex } from "../stemmaIndex";

function makeStemma(overrides: Partial<Stemma> = {}): Stemma {
    return {
        type: "Stemma",
        people: [
            { type: "PersonDescription", id: "p1", name: "Alice", readOnly: false },
            { type: "PersonDescription", id: "p2", name: "Bob", readOnly: false },
            { type: "PersonDescription", id: "p3", name: "Carol", readOnly: false },
        ],
        families: [
            { type: "FamilyDescription", id: "f1", parents: ["p1", "p2"], children: ["p3"], readOnly: false },
        ],
        ...overrides,
    };
}

describe("deriveGhostLayout — no focus", () => {
    it("returns empty layout when focusedId is null", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout(null, index);
        expect(layout.families).toHaveLength(0);
        expect(layout.persons).toHaveLength(0);
        expect(layout.anchorEdges).toHaveLength(0);
    });
});

describe("deriveGhostLayout — focused person without parent family", () => {
    it("returns shared east family + parent family, three ghost persons", () => {
        const index = new StemmaIndex(makeStemma());
        // p1 is a parent in f1, not a child of any family
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        expect(layout.families).toHaveLength(2);
        expect(layout.persons).toHaveLength(3);
        expect(layout.anchorEdges).toHaveLength(2);
        const kinds = layout.persons.map((p) => p.kind).sort();
        expect(kinds).toEqual(["child", "parent", "spouse"]);
    });

    it("shared east family hosts both spouse and child ghosts", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        const spouse = layout.persons.find((p) => p.kind === "spouse")!;
        const child = layout.persons.find((p) => p.kind === "child")!;
        expect(spouse.familyId).toBe(child.familyId);
    });

    it("parent ghost attaches to a separate parent family", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        const parent = layout.persons.find((p) => p.kind === "parent")!;
        const spouse = layout.persons.find((p) => p.kind === "spouse")!;
        expect(parent.familyId).not.toBe(spouse.familyId);
    });

    it("anchor edges: focused acts as parent of east family, child of parent family", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        const byFamily = Object.fromEntries(layout.anchorEdges.map((e) => [e.familyId, e.focusedRole]));
        const eastFamilyId = layout.persons.find((p) => p.kind === "spouse")!.familyId;
        const parentFamilyId = layout.persons.find((p) => p.kind === "parent")!.familyId;
        expect(byFamily[eastFamilyId]).toBe("parent");
        expect(byFamily[parentFamilyId]).toBe("child");
    });

    it("spouse is incoming parent (role=parent); child is outgoing child (role=child)", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        const spouse = layout.persons.find((p) => p.kind === "spouse")!;
        const child = layout.persons.find((p) => p.kind === "child")!;
        expect(spouse.role).toBe("parent");
        expect(child.role).toBe("child");
    });

    it("offset directions: east-shared family is east of focused, parent family above", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        const east = layout.families.find((f) => f.id === layout.persons.find((p) => p.kind === "spouse")!.familyId)!;
        expect(east.dx).toBeGreaterThan(0);
        expect(east.dy).toBe(0);
        const parentFam = layout.families.find((f) => f.id === layout.persons.find((p) => p.kind === "parent")!.familyId)!;
        expect(parentFam.dy).toBeLessThan(0);
    });

    it("assigns distinct stable DOM ids", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        const ids = [...layout.families.map((f) => f.id), ...layout.persons.map((p) => p.id)];
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("assigns correct label keys", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        const byKind = Object.fromEntries(layout.persons.map((p) => [p.kind, p.labelKey]));
        expect(byKind["spouse"]).toBe("v3.addAnotherSpouse");
        expect(byKind["parent"]).toBe("v3.addParent");
        expect(byKind["child"]).toBe("v3.addChild");
    });
});

describe("deriveGhostLayout — focused person with parent family", () => {
    it("omits parent ghost when person already has a parent family", () => {
        const index = new StemmaIndex(makeStemma());
        // p3 is a child in f1, so it already has a parent family
        const layout = deriveGhostLayout({ kind: "person", id: "p3" }, index);
        expect(layout.families).toHaveLength(1);
        expect(layout.persons).toHaveLength(2);
        const kinds = layout.persons.map((p) => p.kind).sort();
        expect(kinds).toEqual(["child", "spouse"]);
    });
});

describe("deriveGhostLayout — focused family", () => {
    it("emits a single child ghost attached to the focused family", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout({ kind: "family", id: "f1" }, index);
        expect(layout.families).toHaveLength(0);
        expect(layout.persons).toHaveLength(1);
        expect(layout.persons[0].kind).toBe("child");
        expect(layout.persons[0].familyId).toBe(FOCUSED_FAMILY_REF);
        expect(layout.persons[0].role).toBe("child");
        expect(layout.persons[0].dy).toBeGreaterThan(0);
        expect(layout.anchorEdges).toHaveLength(0);
    });
});

describe("deriveGhostLayout — isolated person", () => {
    it("produces full layout (east family + parent family) for unconnected person", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const layout = deriveGhostLayout({ kind: "person", id: "lone" }, index);
        expect(layout.families).toHaveLength(2);
        expect(layout.persons).toHaveLength(3);
    });
});

