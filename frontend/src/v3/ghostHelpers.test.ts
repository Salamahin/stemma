import { deriveGhosts, deriveGhostBranches, immediateNeighborIds } from "./ghostHelpers";
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

// ---------------------------------------------------------------------------
// deriveGhosts (legacy API — kept for backward compat)
// ---------------------------------------------------------------------------

describe("deriveGhosts — no focus", () => {
    it("returns empty list when focusedId is null", () => {
        const index = new StemmaIndex(makeStemma());
        expect(deriveGhosts(null, index)).toHaveLength(0);
    });
});

describe("deriveGhosts — focused person with parent family", () => {
    it("returns only a spouse ghost when person already has a parent family", () => {
        const index = new StemmaIndex(makeStemma());
        // p3 is a child in f1, so it already has a parent family
        const ghosts = deriveGhosts({ kind: "person", id: "p3" }, index);
        expect(ghosts).toHaveLength(1);
        expect(ghosts[0].kind).toBe("spouse");
        expect(ghosts[0].id).toBe("ghost-spouse");
        expect(ghosts[0].labelKey).toBe("v3.addAnotherSpouse");
    });
});

describe("deriveGhosts — focused person without parent family", () => {
    it("returns spouse and parent ghosts when person has no parent family", () => {
        const index = new StemmaIndex(makeStemma());
        // p1 is a parent in f1, not a child of any family
        const ghosts = deriveGhosts({ kind: "person", id: "p1" }, index);
        expect(ghosts).toHaveLength(2);
        const kinds = ghosts.map((g) => g.kind);
        expect(kinds).toContain("spouse");
        expect(kinds).toContain("parent");
    });

    it("assigns correct label keys", () => {
        const index = new StemmaIndex(makeStemma());
        const ghosts = deriveGhosts({ kind: "person", id: "p1" }, index);
        const byKind = Object.fromEntries(ghosts.map((g) => [g.kind, g]));
        expect(byKind["spouse"].labelKey).toBe("v3.addAnotherSpouse");
        expect(byKind["parent"].labelKey).toBe("v3.addParent");
    });

    it("assigns stable dom ids", () => {
        const index = new StemmaIndex(makeStemma());
        const ghosts = deriveGhosts({ kind: "person", id: "p1" }, index);
        const ids = ghosts.map((g) => g.id);
        expect(ids).toContain("ghost-spouse");
        expect(ids).toContain("ghost-parent");
    });

    it("applies non-zero seed offsets for parent (upward)", () => {
        const index = new StemmaIndex(makeStemma());
        const ghosts = deriveGhosts({ kind: "person", id: "p1" }, index);
        const parent = ghosts.find((g) => g.kind === "parent")!;
        expect(parent.dy).toBeLessThan(0);
    });

    it("applies non-zero seed offset for spouse (rightward)", () => {
        const index = new StemmaIndex(makeStemma());
        const ghosts = deriveGhosts({ kind: "person", id: "p1" }, index);
        const spouse = ghosts.find((g) => g.kind === "spouse")!;
        expect(spouse.dx).toBeGreaterThan(0);
    });
});

describe("deriveGhosts — focused family", () => {
    it("returns only a child ghost for a focused family", () => {
        const index = new StemmaIndex(makeStemma());
        const ghosts = deriveGhosts({ kind: "family", id: "f1" }, index);
        expect(ghosts).toHaveLength(1);
        expect(ghosts[0].kind).toBe("child");
        expect(ghosts[0].id).toBe("ghost-child");
        expect(ghosts[0].labelKey).toBe("v3.addChild");
    });

    it("applies non-zero seed offset for child (downward)", () => {
        const index = new StemmaIndex(makeStemma());
        const ghosts = deriveGhosts({ kind: "family", id: "f1" }, index);
        expect(ghosts[0].dy).toBeGreaterThan(0);
    });
});

describe("deriveGhosts — isolated person (no families)", () => {
    it("returns spouse and parent ghosts for person with no family connections", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const ghosts = deriveGhosts({ kind: "person", id: "lone" }, index);
        expect(ghosts).toHaveLength(2);
        expect(ghosts.map((g) => g.kind)).toContain("spouse");
        expect(ghosts.map((g) => g.kind)).toContain("parent");
    });
});

// ---------------------------------------------------------------------------
// deriveGhostBranches — new branch-based API
// ---------------------------------------------------------------------------

describe("deriveGhostBranches — no focus", () => {
    it("returns empty list when focusedId is null", () => {
        const index = new StemmaIndex(makeStemma());
        expect(deriveGhostBranches(null, index)).toHaveLength(0);
    });
});

describe("deriveGhostBranches — focused person without parent family", () => {
    it("returns 3 branches: spouse, parent, child", () => {
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "person", id: "p1" }, index);
        expect(branches).toHaveLength(3);
        const kinds = branches.map((b) => b.kind);
        expect(kinds).toContain("spouse");
        expect(kinds).toContain("parent");
        expect(kinds).toContain("child");
    });

    it("spouse and parent branches have a ghost family id; child branch uses existingFamilyId (no ghost family)", () => {
        const index = new StemmaIndex(makeStemma());
        // p1 is a parent in f1, so child branch uses existingFamilyId=f1
        const branches = deriveGhostBranches({ kind: "person", id: "p1" }, index);
        const byKind = Object.fromEntries(branches.map((b) => [b.kind, b]));
        expect(byKind["spouse"].familyId).not.toBeNull();
        expect(byKind["parent"].familyId).not.toBeNull();
        // child branch attaches to existing family f1
        expect(byKind["child"].familyId).toBeNull();
        expect(byKind["child"].existingFamilyId).toBe("f1");
    });

    it("spouse branch offsets are rightward", () => {
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "person", id: "p1" }, index);
        const spouse = branches.find((b) => b.kind === "spouse")!;
        expect(spouse.familyDx).toBeGreaterThan(0);
        expect(spouse.personDx).toBeGreaterThan(0);
        expect(spouse.personDx).toBeGreaterThan(spouse.familyDx);
    });

    it("parent branch offsets are upward", () => {
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "person", id: "p1" }, index);
        const parent = branches.find((b) => b.kind === "parent")!;
        expect(parent.familyDy).toBeLessThan(0);
        expect(parent.personDy).toBeLessThan(0);
        expect(parent.personDy).toBeLessThan(parent.familyDy);
    });

    it("child branch person offset is downward", () => {
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "person", id: "p1" }, index);
        const child = branches.find((b) => b.kind === "child")!;
        // child branch uses existingFamilyId so familyId is null; only personDy matters
        expect(child.personDy).toBeGreaterThan(0);
    });

    it("assigns distinct stable DOM ids (familyId may be null for child branch using existingFamilyId)", () => {
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "person", id: "p1" }, index);
        const allIds = branches.flatMap((b) => [b.familyId, b.personId]).filter((id): id is string => id !== null);
        const unique = new Set(allIds);
        expect(unique.size).toBe(allIds.length);
    });

    it("assigns correct label keys", () => {
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "person", id: "p1" }, index);
        const byKind = Object.fromEntries(branches.map((b) => [b.kind, b]));
        expect(byKind["spouse"].labelKey).toBe("v3.addAnotherSpouse");
        expect(byKind["parent"].labelKey).toBe("v3.addParent");
        expect(byKind["child"].labelKey).toBe("v3.addChild");
    });
});

describe("deriveGhostBranches — focused person with parent family", () => {
    it("returns 2 branches: spouse and child (no parent branch)", () => {
        const index = new StemmaIndex(makeStemma());
        // p3 is a child in f1 but NOT a parent in any spouse-family
        const branches = deriveGhostBranches({ kind: "person", id: "p3" }, index);
        expect(branches).toHaveLength(2);
        const kinds = branches.map((b) => b.kind);
        expect(kinds).toContain("spouse");
        expect(kinds).toContain("child");
        expect(kinds).not.toContain("parent");
    });

    it("child branch falls back to new ghost family when person has no spouse-families", () => {
        const index = new StemmaIndex(makeStemma());
        // p3 is a child in f1 but NOT a parent in any family
        const branches = deriveGhostBranches({ kind: "person", id: "p3" }, index);
        const child = branches.find((b) => b.kind === "child")!;
        // No spouse-family → new ghost family
        expect(child.familyId).not.toBeNull();
        expect(child.existingFamilyId).toBeUndefined();
    });
});

describe("deriveGhostBranches — focused family", () => {
    it("returns 1 branch: child with no ghost family (familyId is null)", () => {
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "family", id: "f1" }, index);
        expect(branches).toHaveLength(1);
        expect(branches[0].kind).toBe("child");
        expect(branches[0].familyId).toBeNull();
    });

    it("child branch for family-focused uses downward person offset", () => {
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "family", id: "f1" }, index);
        expect(branches[0].personDy).toBeGreaterThan(0);
    });
});

describe("deriveGhostBranches — isolated person", () => {
    it("returns 3 branches for a person with no family connections", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const branches = deriveGhostBranches({ kind: "person", id: "lone" }, index);
        expect(branches).toHaveLength(3);
        const kinds = branches.map((b) => b.kind);
        expect(kinds).toContain("spouse");
        expect(kinds).toContain("parent");
        expect(kinds).toContain("child");
    });

    it("child branch uses new ghost family (no existingFamilyId) for isolated person", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const branches = deriveGhostBranches({ kind: "person", id: "lone" }, index);
        const child = branches.find((b) => b.kind === "child")!;
        expect(child.familyId).not.toBeNull();
        expect(child.existingFamilyId).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// deriveGhostBranches — existingFamilyId new acceptance cases (issue #206)
// ---------------------------------------------------------------------------

describe("deriveGhostBranches — spouse-family with ≥1 child → child branch uses existingFamilyId", () => {
    it("ghost child uses existingFamilyId when spouse-family has existing children", () => {
        // p1 is a parent in f1 which already has child p3
        const index = new StemmaIndex(makeStemma());
        const branches = deriveGhostBranches({ kind: "person", id: "p1" }, index);
        const childBranches = branches.filter((b) => b.kind === "child");
        expect(childBranches).toHaveLength(1);
        expect(childBranches[0].existingFamilyId).toBe("f1");
        expect(childBranches[0].familyId).toBeNull();
    });
});

describe("deriveGhostBranches — spouse-family with 0 children → child branch uses existingFamilyId", () => {
    it("ghost child uses existingFamilyId when spouse-family has no children yet", () => {
        const emptyStemma: Stemma = {
            type: "Stemma",
            people: [
                { type: "PersonDescription", id: "a", name: "A", readOnly: false },
                { type: "PersonDescription", id: "b", name: "B", readOnly: false },
            ],
            families: [
                { type: "FamilyDescription", id: "fAB", parents: ["a", "b"], children: [], readOnly: false },
            ],
        };
        const index = new StemmaIndex(emptyStemma);
        const branches = deriveGhostBranches({ kind: "person", id: "a" }, index);
        const childBranches = branches.filter((b) => b.kind === "child");
        expect(childBranches).toHaveLength(1);
        expect(childBranches[0].existingFamilyId).toBe("fAB");
        expect(childBranches[0].familyId).toBeNull();
    });
});

describe("deriveGhostBranches — multiple spouse-families → one ghost-child per family", () => {
    it("emits one child branch per spouse-family", () => {
        const multiStemma: Stemma = {
            type: "Stemma",
            people: [
                { type: "PersonDescription", id: "a", name: "A", readOnly: false },
                { type: "PersonDescription", id: "b", name: "B", readOnly: false },
                { type: "PersonDescription", id: "c", name: "C", readOnly: false },
                { type: "PersonDescription", id: "d", name: "D", readOnly: false },
            ],
            families: [
                { type: "FamilyDescription", id: "fAB", parents: ["a", "b"], children: [], readOnly: false },
                { type: "FamilyDescription", id: "fAC", parents: ["a", "c"], children: ["d"], readOnly: false },
            ],
        };
        const index = new StemmaIndex(multiStemma);
        const branches = deriveGhostBranches({ kind: "person", id: "a" }, index);
        const childBranches = branches.filter((b) => b.kind === "child");
        expect(childBranches).toHaveLength(2);
        const familyIds = childBranches.map((b) => b.existingFamilyId);
        expect(familyIds).toContain("fAB");
        expect(familyIds).toContain("fAC");
        // all child branches use existingFamilyId (no ghost family)
        for (const b of childBranches) {
            expect(b.familyId).toBeNull();
        }
    });

    it("assigns distinct ghost-person DOM ids for each child branch", () => {
        const multiStemma: Stemma = {
            type: "Stemma",
            people: [
                { type: "PersonDescription", id: "a", name: "A", readOnly: false },
                { type: "PersonDescription", id: "b", name: "B", readOnly: false },
                { type: "PersonDescription", id: "c", name: "C", readOnly: false },
            ],
            families: [
                { type: "FamilyDescription", id: "fAB", parents: ["a", "b"], children: [], readOnly: false },
                { type: "FamilyDescription", id: "fAC", parents: ["a", "c"], children: [], readOnly: false },
            ],
        };
        const index = new StemmaIndex(multiStemma);
        const branches = deriveGhostBranches({ kind: "person", id: "a" }, index);
        const personIds = branches.map((b) => b.personId);
        const unique = new Set(personIds);
        expect(unique.size).toBe(personIds.length);
    });
});

describe("deriveGhostBranches — no spouse-family → fallback to new ghost family + ghost-child", () => {
    it("child branch creates new ghost family when person has no spouse-families", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const branches = deriveGhostBranches({ kind: "person", id: "lone" }, index);
        const child = branches.find((b) => b.kind === "child")!;
        expect(child.familyId).not.toBeNull();
        expect(child.existingFamilyId).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// immediateNeighborIds
// ---------------------------------------------------------------------------

describe("immediateNeighborIds — focused person", () => {
    it("returns the containing family and all co-members, excluding the focused person", () => {
        const index = new StemmaIndex(makeStemma());
        // p1 is in f1 with p2 as co-parent and p3 as child
        const refs = immediateNeighborIds({ kind: "person", id: "p1" }, index);
        const ids = refs.map((r) => r.id);
        expect(ids).toContain("f1");
        expect(ids).toContain("p2");
        expect(ids).toContain("p3");
        expect(ids).not.toContain("p1");
    });

    it("tags families as kind=family and people as kind=person", () => {
        const index = new StemmaIndex(makeStemma());
        const refs = immediateNeighborIds({ kind: "person", id: "p1" }, index);
        const byId = Object.fromEntries(refs.map((r) => [r.id, r.kind]));
        expect(byId["f1"]).toBe("family");
        expect(byId["p2"]).toBe("person");
        expect(byId["p3"]).toBe("person");
    });

    it("returns empty list for an isolated person (no families)", () => {
        const isolatedStemma: Stemma = {
            type: "Stemma",
            people: [{ type: "PersonDescription", id: "lone", name: "Lone", readOnly: false }],
            families: [],
        };
        const index = new StemmaIndex(isolatedStemma);
        const refs = immediateNeighborIds({ kind: "person", id: "lone" }, index);
        expect(refs).toHaveLength(0);
    });

    it("does not include duplicates when a person shares multiple families", () => {
        const multiStemma: Stemma = {
            type: "Stemma",
            people: [
                { type: "PersonDescription", id: "a", name: "A", readOnly: false },
                { type: "PersonDescription", id: "b", name: "B", readOnly: false },
                { type: "PersonDescription", id: "c", name: "C", readOnly: false },
            ],
            families: [
                { type: "FamilyDescription", id: "fA", parents: ["a", "b"], children: [], readOnly: false },
                { type: "FamilyDescription", id: "fB", parents: ["a", "c"], children: [], readOnly: false },
            ],
        };
        const index = new StemmaIndex(multiStemma);
        const refs = immediateNeighborIds({ kind: "person", id: "a" }, index);
        const ids = refs.map((r) => r.id);
        // 'a' itself must not appear; b, c, fA, fB must each appear exactly once
        expect(ids.filter((id) => id === "a")).toHaveLength(0);
        expect(ids.filter((id) => id === "b")).toHaveLength(1);
        expect(ids.filter((id) => id === "c")).toHaveLength(1);
        expect(ids.filter((id) => id === "fA")).toHaveLength(1);
        expect(ids.filter((id) => id === "fB")).toHaveLength(1);
    });
});

describe("immediateNeighborIds — focused family", () => {
    it("returns all parents and children, excluding the focused family id", () => {
        const index = new StemmaIndex(makeStemma());
        // f1 has parents [p1, p2] and children [p3]
        const refs = immediateNeighborIds({ kind: "family", id: "f1" }, index);
        const ids = refs.map((r) => r.id);
        expect(ids).toContain("p1");
        expect(ids).toContain("p2");
        expect(ids).toContain("p3");
        expect(ids).not.toContain("f1");
    });

    it("all refs for focused family are kind=person", () => {
        const index = new StemmaIndex(makeStemma());
        const refs = immediateNeighborIds({ kind: "family", id: "f1" }, index);
        for (const ref of refs) {
            expect(ref.kind).toBe("person");
        }
    });

    it("returns empty list for a family with no members", () => {
        const emptyStemma: Stemma = {
            type: "Stemma",
            people: [],
            families: [
                { type: "FamilyDescription", id: "empty-fam", parents: [], children: [], readOnly: false },
            ],
        };
        const index = new StemmaIndex(emptyStemma);
        const refs = immediateNeighborIds({ kind: "family", id: "empty-fam" }, index);
        expect(refs).toHaveLength(0);
    });
});
