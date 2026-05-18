import { selectStemmaId } from "./appControllerSelection";

import type { StemmaDescription } from "./model";

describe("selectStemmaId", () => {
    const stemmas: StemmaDescription[] = [
        { type: "StemmaDescription", id: "a", name: "A", removable: true },
        { type: "StemmaDescription", id: "b", name: "B", removable: true },
        { type: "StemmaDescription", id: "c", name: "C", removable: true },
    ];

    test("falls back to the first stemma when last id is missing", () => {
        expect(selectStemmaId(stemmas, undefined)).toBe("a");
    });

    test("selects the last stemma when it exists", () => {
        expect(selectStemmaId(stemmas, "c")).toBe("c");
    });

    test("falls back when last id is not found", () => {
        expect(selectStemmaId(stemmas, "missing")).toBe("a");
    });

    test("returns null for empty list", () => {
        expect(selectStemmaId([], "a")).toBeNull();
    });

    test("prefers defaultStemmaId when no lastStemmaId", () => {
        expect(selectStemmaId(stemmas, undefined, "b")).toBe("b");
    });

    test("lastStemmaId wins over defaultStemmaId", () => {
        expect(selectStemmaId(stemmas, "c", "b")).toBe("c");
    });

    test("falls back to first when defaultStemmaId is missing from list", () => {
        expect(selectStemmaId(stemmas, undefined, "zzz")).toBe("a");
    });
});
