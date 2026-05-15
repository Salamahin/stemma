import { HiglightLineages, HighlightAll } from "./highlight";
import type { Stemma } from "./model";
import { StemmaIndex } from "./stemmaIndex";

const stemma: Stemma = {
    type: "Stemma",
    people: [
        { type: "PersonDescription", id: "1", name: "Ann", readOnly: false },
        { type: "PersonDescription", id: "2", name: "Ben", readOnly: false },
        { type: "PersonDescription", id: "3", name: "Cam", readOnly: false },
        { type: "PersonDescription", id: "4", name: "Dan", readOnly: false },
    ],
    families: [
        { type: "FamilyDescription", id: "f1", parents: ["1"], children: ["2"], readOnly: false },
        { type: "FamilyDescription", id: "f2", parents: ["3"], children: ["4"], readOnly: false },
    ],
};

describe("HighlightAll", () => {
    test("highlights everything", () => {
        const highlight = new HighlightAll();
        expect(highlight.personIsHighlighted("1")).toBe(true);
        expect(highlight.familyIsHighlighted("f1")).toBe(true);
    });
});

describe("HiglightLineages", () => {
    test("highlights all when no people selected", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HiglightLineages(index, []);
        expect(highlight.personIsHighlighted("1")).toBe(true);
        expect(highlight.familyIsHighlighted("f2")).toBe(true);
    });

    test("highlights only related people for a selected person", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HiglightLineages(index, ["1"]);
        expect(highlight.personIsHighlighted("1")).toBe(true);
        expect(highlight.personIsHighlighted("2")).toBe(true);
        expect(highlight.personIsHighlighted("3")).toBe(false);
    });

    test("updates highlight set when adding and removing", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HiglightLineages(index, ["1"]);
        expect(highlight.personIsHighlighted("3")).toBe(false);
        highlight.pushPerson("3");
        expect(highlight.personIsHighlighted("3")).toBe(true);
        highlight.pop();
        expect(highlight.personIsHighlighted("3")).toBe(false);
    });

    test("reports inactive when nothing is selected", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HiglightLineages(index, []);
        expect(highlight.isActive()).toBe(false);
        expect(highlight.highlightedPeopleIds().size).toBe(0);
        expect(highlight.highlightedFamilyIds().size).toBe(0);
    });

    test("exposes highlighted people and families for active lineage", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HiglightLineages(index, ["1"]);
        expect(highlight.isActive()).toBe(true);
        const people = highlight.highlightedPeopleIds();
        const families = highlight.highlightedFamilyIds();
        expect(people.has("1")).toBe(true);
        expect(people.has("2")).toBe(true);
        expect(people.has("3")).toBe(false);
        expect(families.has("f1")).toBe(true);
        expect(families.has("f2")).toBe(false);
    });
});
