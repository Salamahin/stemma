import { HighlightLineages, HighlightAll, HighlightAgeStep, effectiveHighlight } from "./highlight";
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

describe("HighlightLineages", () => {
    test("highlights all when no people selected", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HighlightLineages(index, []);
        expect(highlight.personIsHighlighted("1")).toBe(true);
        expect(highlight.familyIsHighlighted("f2")).toBe(true);
    });

    test("highlights only related people for a selected person", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HighlightLineages(index, ["1"]);
        expect(highlight.personIsHighlighted("1")).toBe(true);
        expect(highlight.personIsHighlighted("2")).toBe(true);
        expect(highlight.personIsHighlighted("3")).toBe(false);
    });

    test("updates highlight set when adding and removing", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HighlightLineages(index, ["1"]);
        expect(highlight.personIsHighlighted("3")).toBe(false);
        highlight.pushPerson("3");
        expect(highlight.personIsHighlighted("3")).toBe(true);
        highlight.pop();
        expect(highlight.personIsHighlighted("3")).toBe(false);
    });

    test("reports inactive when nothing is selected", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HighlightLineages(index, []);
        expect(highlight.isActive()).toBe(false);
        expect(highlight.highlightedPeopleIds().size).toBe(0);
        expect(highlight.highlightedFamilyIds().size).toBe(0);
    });

    test("exposes highlighted people and families for active lineage", () => {
        const index = new StemmaIndex(stemma);
        const highlight = new HighlightLineages(index, ["1"]);
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

describe("HighlightAgeStep", () => {
    const dated: Stemma = {
        type: "Stemma",
        people: [
            { type: "PersonDescription", id: "old", name: "Old", birthDate: "1720", readOnly: false },
            { type: "PersonDescription", id: "mid", name: "Mid", birthDate: "1810", readOnly: false },
            { type: "PersonDescription", id: "young", name: "Young", birthDate: "1905", readOnly: false },
            { type: "PersonDescription", id: "other", name: "Other", birthDate: "1990", readOnly: false },
        ],
        families: [
            { type: "FamilyDescription", id: "f1", parents: ["old"], children: ["mid"], readOnly: false },
            { type: "FamilyDescription", id: "f2", parents: ["mid"], children: ["young"], readOnly: false },
        ],
    };

    test("highlights the people of the chosen age steps and the families they are in", () => {
        const index = new StemmaIndex(dated);
        const step = index.ageStepOf(1810)!;
        const h = new HighlightAgeStep(index, new Set([step]));
        expect(h.personIsHighlighted("mid")).toBe(true);
        expect(h.personIsHighlighted("old")).toBe(false);
        expect(h.personIsHighlighted("young")).toBe(false);
        expect(h.familyIsHighlighted("f1")).toBe(true); // mid is a child there
        expect(h.familyIsHighlighted("f2")).toBe(true); // and a parent here
    });

    test("several age steps at once", () => {
        const index = new StemmaIndex(dated);
        const h = new HighlightAgeStep(index, new Set([index.ageStepOf(1720)!, index.ageStepOf(1905)!]));
        expect(h.personIsHighlighted("old")).toBe(true);
        expect(h.personIsHighlighted("young")).toBe(true);
        expect(h.personIsHighlighted("mid")).toBe(false);
    });

    test("pinned or hovered people win over an age step", () => {
        const index = new StemmaIndex(dated);
        const lineages = new HighlightLineages(index, []);
        const steps = new Set([index.ageStepOf(1810)!]);
        expect(effectiveHighlight(lineages, index, steps)).toBeInstanceOf(HighlightAgeStep);
        lineages.pushPerson("other");
        expect(effectiveHighlight(lineages, index, steps)).toBe(lineages);
        lineages.pop();
        expect(effectiveHighlight(lineages, index, new Set())).toBe(lineages);
    });
});
