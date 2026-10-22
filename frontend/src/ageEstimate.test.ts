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
        expect(ages.birthYear("mum")!.year).toBeGreaterThan(ages.birthYear("grandpa")!.year);
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
        expect(ages.birthYear("a")!.known).toBe(false);
    });

    test("years lists every dated person once", () => {
        const ages = estimateAges(stemma([person("a", "1700"), person("b", "1990"), person("c")], []));
        expect(ages.years().sort()).toEqual([1700, 1990]);
    });

    test("the generation length is learned from the tree's own dated parents and children", () => {
        const ages = estimateAges(
            stemma(
                [person("p1", "1800"), person("c1", "1830"), person("p2", "1900"), person("c2", "1930"), person("p3", "1700"), person("c3")],
                [family("f1", ["p1"], ["c1"]), family("f2", ["p2"], ["c2"]), family("f3", ["p3"], ["c3"])],
            ),
        );
        expect(ages.generationYears).toBe(30);
        expect(ages.birthYear("c3")!.year).toBe(1730);
    });

    test("an estimate stays within what the known dates allow", () => {
        // An undated parent between a grandparent born 1850 and a child born 1900
        // must be born 15+ years after the one and 15+ years before the other.
        const ages = estimateAges(
            stemma(
                [person("gp", "1850"), person("p"), person("c", "1900")],
                [family("f1", ["gp"], ["p"]), family("f2", ["p"], ["c"])],
            ),
        );
        const y = ages.birthYear("p")!.year;
        expect(y).toBeGreaterThanOrEqual(1850 + 15);
        expect(y).toBeLessThanOrEqual(1900 - 15);
    });

    test("nobody is estimated to be born after today or more than 100 years before their death", () => {
        const ages = estimateAges(
            stemma([person("p", "2010"), person("kid"), person("old", undefined, "1900")], [family("f", ["p"], ["kid"])]),
            2026,
        );
        expect(ages.birthYear("kid")!.year).toBeLessThanOrEqual(2026);
        expect(ages.birthYear("old")!.year).toBeGreaterThanOrEqual(1800);
    });

    test("a branch with no dates at all gets no years", () => {
        const ages = estimateAges(
            stemma(
                [person("old"), person("mid"), person("dated", "1900"), person("loner")],
                [family("f1", ["old"], ["mid"]), family("f2", ["dated"], [])],
            ),
        );
        expect(ages.birthYear("old")).toBeNull();
        expect(ages.birthYear("loner")).toBeNull();
        expect(ages.years()).toEqual([1900]);
    });

    test("an unknown person id has no year", () => {
        const ages = estimateAges(stemma([], []));
        expect(ages.birthYear("nobody")).toBeNull();
    });
});
