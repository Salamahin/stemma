import { linkOptions } from "./ghostLink";
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

describe("linkOptions", () => {
    const opts = (a: string, b: string, extra?: (s: Stemma) => void) => {
        const s = stemma();
        extra?.(s);
        return linkOptions(new StemmaIndex(s), a, b);
    };

    test("strangers: spouses, or either a child of the other in a new family", () => {
        expect(opts("stranger", "orphanKid")).toEqual([
            { kind: "spouses", a: "stranger", b: "orphanKid" },
            { kind: "child", childId: "orphanKid", parentId: "stranger", familyId: null },
            { kind: "child", childId: "stranger", parentId: "orphanKid", familyId: null },
        ]);
    });

    test("a child of someone married: in that family or with them alone", () => {
        expect(opts("dad", "orphanKid")).toContainEqual({ kind: "child", childId: "orphanKid", parentId: "dad", familyId: "f2" });
        expect(opts("dad", "orphanKid")).toContainEqual({ kind: "child", childId: "orphanKid", parentId: "dad", familyId: null });
        // dad already has parents: he cannot become orphanKid's child
        expect(opts("dad", "orphanKid").some((o) => o.kind === "child" && o.childId === "dad")).toBe(false);
    });

    test("no cycles, no second marriage to the same person, nothing with read-only people", () => {
        // grandpa is kid's ancestor: kid cannot be his parent, and kid already has parents
        expect(opts("grandpa", "kid").filter((o) => o.kind === "child")).toEqual([]);
        expect(opts("dad", "mum").some((o) => o.kind === "spouses")).toBe(false);
        expect(opts("stranger", "locked")).toEqual([]);
        expect(opts("stranger", "stranger")).toEqual([]);
    });

    test("a family of the parent alone is reused instead of a new one", () => {
        const o = opts("stranger", "orphanKid", (s) => {
            s.people.push({ type: "PersonDescription", id: "other", name: "other", readOnly: false });
            s.families.push({ type: "FamilyDescription", id: "solo", parents: ["stranger"], children: ["other"], readOnly: false });
        });
        const asChild = o.filter((x) => x.kind === "child" && x.childId === "orphanKid");
        expect(asChild).toEqual([{ kind: "child", childId: "orphanKid", parentId: "stranger", familyId: "solo" }]);
    });
});
