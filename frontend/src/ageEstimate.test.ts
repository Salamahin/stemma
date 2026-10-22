import { estimateAges } from "./ageEstimate";
import type { FamilyDescription, PersonDescription, Stemma } from "./model";

function person(id: string, birthDate?: string, deathDate?: string): PersonDescription {
    return { type: "PersonDescription", id, name: id, birthDate, deathDate, readOnly: false };
}

function family(id: string, parents: string[], children: string[]): FamilyDescription {
    return { type: "FamilyDescription", id, parents, children, readOnly: false };
}

function stemma(people: PersonDescription[], families: FamilyDescription[]): Stemma {
    return { type: "Stemma", people, families };
}

describe("estimateAges", () => {
    test("a known birth year is used as is, whatever the precision", () => {
        const ages = estimateAges(stemma([person("a", "~1899-03-16"), person("b", "1950-02")], []));
        expect(ages.birthYear("a")).toEqual({ year: 1899, known: true });
        expect(ages.birthYear("b")).toEqual({ year: 1950, known: true });
    });

    test("a spouse with no dates is as old as their partner, not as old as the oldest ancestor", () => {
        const ages = estimateAges(
            stemma(
                [person("grandpa", "1880"), person("dad", "1910"), person("mum"), person("kid", "1940")],
                [family("f1", ["grandpa"], ["dad"]), family("f2", ["dad", "mum"], ["kid"])],
            ),
        );
        expect(ages.birthYear("mum")!.known).toBe(false);
        expect(Math.abs(ages.birthYear("mum")!.year - 1910)).toBeLessThanOrEqual(5);
        expect(ages.ratio("mum")).toBeGreaterThan(ages.ratio("grandpa"));
    });

    test("an undated person is placed a generation away from dated parents and children", () => {
        const ages = estimateAges(
            stemma(
                [person("p", "1900"), person("c"), person("g", "1960")],
                [family("f1", ["p"], ["c"]), family("f2", ["c"], ["g"])],
            ),
        );
        const year = ages.birthYear("c")!.year;
        expect(year).toBeGreaterThan(1900);
        expect(year).toBeLessThan(1960);
    });

    test("a lone death date still dates a person", () => {
        const ages = estimateAges(stemma([person("a", undefined, "1943-10-28"), person("b", "1990")], []));
        expect(ages.birthYear("a")!.year).toBeLessThan(1943);
        expect(ages.ratio("a")).toBeLessThan(ages.ratio("b"));
    });

    test("older is a lower ratio, younger a higher one, within 0..1", () => {
        const ages = estimateAges(stemma([person("a", "1700"), person("b", "1850"), person("c", "2000")], []));
        expect(ages.ratio("a")).toBe(0);
        expect(ages.ratio("c")).toBe(1);
        expect(ages.ratio("b")).toBeGreaterThan(0);
        expect(ages.ratio("b")).toBeLessThan(1);
        expect(ages.yearRange()).toEqual([1700, 2000]);
    });

    test("a family with no dates at all is still ordered by generation", () => {
        const ages = estimateAges(
            stemma(
                [person("old"), person("mid"), person("young")],
                [family("f1", ["old"], ["mid"]), family("f2", ["mid"], ["young"])],
            ),
        );
        expect(ages.birthYear("old")).toBeNull();
        expect(ages.ratio("old")).toBeLessThan(ages.ratio("mid"));
        expect(ages.ratio("mid")).toBeLessThan(ages.ratio("young"));
        expect(ages.yearRange()).toBeNull();
    });

    test("an unknown person id gets the middle of the scale", () => {
        const ages = estimateAges(stemma([], []));
        expect(ages.ratio("nobody")).toBe(0.5);
        expect(ages.birthYear("nobody")).toBeNull();
    });
});
