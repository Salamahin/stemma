import { selectStemmaId } from "./appControllerSelection";

describe("selectStemmaId", () => {
    const stemmas = [
        { id: "a", name: "A", removable: true },
        { id: "b", name: "B", removable: true },
        { id: "c", name: "C", removable: true },
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
});
