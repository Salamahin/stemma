import {
    deriveGhostLayout,
    existingFamilyRef,
    immediateNeighborIds,
    realFamilyIdFromRef,
    FOCUSED_FAMILY_REF,
    EXISTING_FAMILY_PREFIX,
} from "./ghostHelpers";
import type { Stemma } from "./model";
import { StemmaIndex } from "./stemmaIndex";

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
    it("empty when focusedId is null", () => {
        const index = new StemmaIndex(makeStemma());
        const layout = deriveGhostLayout(null, index);
        expect(layout.families).toHaveLength(0);
        expect(layout.persons).toHaveLength(0);
        expect(layout.anchorEdges).toHaveLength(0);
    });
});

describe("deriveGhostLayout — focused isolated person", () => {
    it("shared east family + parent family, three ghost persons (spouse, child, parent)", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const layout = deriveGhostLayout({ kind: "person", id: "lone" }, index);
        expect(layout.families).toHaveLength(2);
        expect(layout.persons).toHaveLength(3);
        expect(layout.anchorEdges).toHaveLength(2);
        const kinds = layout.persons.map((p) => p.kind).sort();
        expect(kinds).toEqual(["child", "parent", "spouse"]);
    });

    it("shared east family hosts both spouse and child", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const layout = deriveGhostLayout({ kind: "person", id: "lone" }, index);
        const spouse = layout.persons.find((p) => p.kind === "spouse")!;
        const child = layout.persons.find((p) => p.kind === "child")!;
        expect(spouse.familyId).toBe(child.familyId);
        expect(layout.families.some((f) => f.id === spouse.familyId)).toBe(true);
    });

    it("spouse is incoming parent of east family; child is outgoing child", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const layout = deriveGhostLayout({ kind: "person", id: "lone" }, index);
        expect(layout.persons.find((p) => p.kind === "spouse")!.role).toBe("parent");
        expect(layout.persons.find((p) => p.kind === "child")!.role).toBe("child");
    });

    it("focused acts as parent of east family, child of parent family", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const layout = deriveGhostLayout({ kind: "person", id: "lone" }, index);
        const byFamily = Object.fromEntries(layout.anchorEdges.map((e) => [e.familyId, e.focusedRole]));
        const eastId = layout.persons.find((p) => p.kind === "spouse")!.familyId;
        const parentFamId = layout.persons.find((p) => p.kind === "parent")!.familyId;
        expect(byFamily[eastId]).toBe("parent");
        expect(byFamily[parentFamId]).toBe("child");
    });

    it("east family east of focused, parent family above", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const layout = deriveGhostLayout({ kind: "person", id: "lone" }, index);
        const east = layout.families.find((f) => f.id === layout.persons.find((p) => p.kind === "spouse")!.familyId)!;
        expect(east.dx).toBeGreaterThan(0);
        expect(east.dy).toBe(0);
        const parentFam = layout.families.find((f) => f.id === layout.persons.find((p) => p.kind === "parent")!.familyId)!;
        expect(parentFam.dy).toBeLessThan(0);
    });
});

describe("deriveGhostLayout — focused person with parent family", () => {
    it("omits parent ghost when the person already has a parent family", () => {
        const index = new StemmaIndex(makeStemma());
        // p3 is a child in f1
        const layout = deriveGhostLayout({ kind: "person", id: "p3" }, index);
        const kinds = layout.persons.map((p) => p.kind);
        expect(kinds).not.toContain("parent");
    });
});

describe("deriveGhostLayout — focused person with existing spouse-families", () => {
    it("keeps a single child ghost in the east family regardless of existing families", () => {
        const stemma: Stemma = {
            type: "Stemma",
            people: [
                { type: "PersonDescription", id: "p1", name: "Alice", readOnly: false },
                { type: "PersonDescription", id: "p2", name: "Bob", readOnly: false },
                { type: "PersonDescription", id: "p3", name: "Carol", readOnly: false },
            ],
            families: [
                { type: "FamilyDescription", id: "fA", parents: ["p1", "p2"], children: [], readOnly: false },
                { type: "FamilyDescription", id: "fB", parents: ["p1", "p3"], children: [], readOnly: false },
            ],
        };
        const index = new StemmaIndex(stemma);
        const layout = deriveGhostLayout({ kind: "person", id: "p1" }, index);
        const childPlans = layout.persons.filter((p) => p.kind === "child");
        expect(childPlans).toHaveLength(1);
        expect(childPlans[0].familyId).toBe("ghost-family-east");
    });
});

describe("deriveGhostLayout — focused family", () => {
    it("single child ghost attached to the focused family", () => {
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

describe("immediateNeighborIds — skip pending entities", () => {
    it("excludes a pending family from the focused person's neighbor list", () => {
        const stemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [
                {
                    type: "FamilyDescription",
                    id: "pending-family-abc",
                    parents: ["lone"],
                    children: [],
                    readOnly: true,
                },
            ],
        };
        const index = new StemmaIndex(stemma);
        const refs = immediateNeighborIds({ kind: "person", id: "lone" }, index);
        expect(refs.find((r) => r.id === "pending-family-abc")).toBeUndefined();
    });

    it("still includes real neighbors alongside a pending family", () => {
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
        const refs = immediateNeighborIds({ kind: "person", id: "p1" }, index);
        expect(refs.some((r) => r.id === "fReal")).toBe(true);
        expect(refs.some((r) => r.id === "p2")).toBe(true);
        expect(refs.some((r) => r.id === "pending-family-xyz")).toBe(false);
    });
});

describe("existingFamilyRef / realFamilyIdFromRef round-trip", () => {
    it("encodes and decodes the real family id", () => {
        const ref = existingFamilyRef("fA");
        expect(ref.startsWith(EXISTING_FAMILY_PREFIX)).toBe(true);
        expect(realFamilyIdFromRef(ref)).toBe("fA");
    });

    it("returns null for non-existing-family ids", () => {
        expect(realFamilyIdFromRef("ghost-family-east")).toBeNull();
        expect(realFamilyIdFromRef(FOCUSED_FAMILY_REF)).toBeNull();
    });
});
