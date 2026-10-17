import { linkCandidates } from "./ghostLink";
import { StemmaIndex } from "./stemmaIndex";
import type { Stemma } from "./model";

// grandpa ─┬─ dad ─┬─ kid
// grandma ─┘  mum ─┘
// stranger (no relations), locked (read-only), orphanKid (no parents)
function stemma(): Stemma {
    const p = (id: string, readOnly = false) => ({ type: "PersonDescription" as const, id, name: id, readOnly });
    return {
        type: "Stemma",
        people: [p("grandpa"), p("grandma"), p("dad"), p("mum"), p("kid"), p("stranger"), p("orphanKid"), p("locked", true)],
        families: [
            { type: "FamilyDescription", id: "f1", parents: ["grandpa", "grandma"], children: ["dad"], readOnly: false },
            { type: "FamilyDescription", id: "f2", parents: ["dad", "mum"], children: ["kid"], readOnly: false },
        ],
    };
}

const ids = (target: Parameters<typeof linkCandidates>[2]) => {
    const s = stemma();
    return linkCandidates(new StemmaIndex(s), s.people, target).map((p) => p.id).sort();
};

describe("linkCandidates", () => {
    test("a spouse: anyone but the person and their current spouses; never read-only people", () => {
        expect(ids({ kind: "spouse", personId: "dad" })).toEqual(["grandma", "grandpa", "kid", "orphanKid", "stranger"]);
    });

    test("a parent of a person: nobody among their descendants (no cycles)", () => {
        expect(ids({ kind: "parent", personId: "orphanKid" })).toEqual(["dad", "grandma", "grandpa", "kid", "mum", "stranger"]);
        // dad's descendants (kid) cannot become his parent
        expect(ids({ kind: "parent", personId: "dad" })).not.toContain("kid");
    });

    test("a child of a person: only people without parents, never their ancestors", () => {
        // orphanKid, stranger, grandpa, grandma and mum have no parents; grandpa/grandma are dad's ancestors
        expect(ids({ kind: "child", personId: "dad" })).toEqual(["mum", "orphanKid", "stranger"]);
    });

    test("a child of an existing family: the family's own rules (no parents yet, no cycle, not a member)", () => {
        expect(ids({ kind: "child", familyId: "f2" })).toEqual(["orphanKid", "stranger"]);
        expect(ids({ kind: "child", familyId: "f1" })).toEqual(["mum", "orphanKid", "stranger"]);
    });

    test("a parent of an existing family: only while it has fewer than two parents, never a descendant", () => {
        expect(ids({ kind: "parent", familyId: "f2" })).toEqual([]);
        const s = stemma();
        s.families.push({ type: "FamilyDescription", id: "f3", parents: ["mum"], children: ["orphanKid"], readOnly: false });
        const got = linkCandidates(new StemmaIndex(s), s.people, { kind: "parent", familyId: "f3" }).map((p) => p.id).sort();
        expect(got).toEqual(["dad", "grandma", "grandpa", "kid", "stranger"]);
    });
});
