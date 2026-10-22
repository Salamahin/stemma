import { ageSteps, romanCentury } from "./ageSteps";

describe("ageSteps", () => {
    test("a tree spanning centuries is split by century", () => {
        const s = ageSteps([1596, 1650, 1700, 1800, 1900, 2021])!;
        expect(s.size).toBe(100);
        expect(s.count).toBe(6);
        expect(s.labels).toEqual(["XVI", "XVII", "XVIII", "XIX", "XX", "XXI"]);
        expect(s.stepOf(1596)).toBe(0);
        expect(s.stepOf(1899)).toBe(3);
        expect(s.stepOf(1900)).toBe(4);
    });

    test("a family tree of a couple of centuries is split by half-century", () => {
        const s = ageSteps([1852, 1880, 1910, 1950, 1985, 2015])!;
        expect(s.size).toBe(50);
        expect(s.labels).toEqual(["1850", "1900", "1950", "2000"]);
        expect(s.stepOf(1899)).toBe(0);
        expect(s.stepOf(2015)).toBe(3);
    });

    test("never more than six steps", () => {
        for (const span of [30, 80, 140, 260, 420, 900, 2000]) {
            const s = ageSteps([1000, 1000 + span])!;
            expect(s.count).toBeLessThanOrEqual(6);
            expect(s.count).toBeGreaterThanOrEqual(2);
        }
    });

    test("a few outliers fall into the end steps instead of stretching the scale", () => {
        const years = [1100, ...Array.from({ length: 98 }, (_, i) => 1850 + i * 1.5), 2020];
        const s = ageSteps(years)!;
        expect(s.size).toBeLessThanOrEqual(50);
        expect(s.stepOf(1100)).toBe(0);
        expect(s.stepOf(2020)).toBe(s.count - 1);
    });

    test("no years, no steps", () => {
        expect(ageSteps([])).toBeNull();
    });

    test("one year is one step", () => {
        const s = ageSteps([1900, 1900])!;
        expect(s.count).toBe(1);
        expect(s.stepOf(1900)).toBe(0);
    });
});

test("romanCentury", () => {
    expect(romanCentury(1596)).toBe("XVI");
    expect(romanCentury(1900)).toBe("XX");
    expect(romanCentury(2001)).toBe("XXI");
    expect(romanCentury(1401)).toBe("XV");
});
