import { get } from "svelte/store";
import { AppController } from "./appController";
import type { Stemma } from "./model";

function drainPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("AppController", () => {
    const stemmaA: Stemma = { type: "Stemma", people: [], families: [] };
    const stemmaB: Stemma = {
        type: "Stemma",
        people: [{ type: "PersonDescription", id: "1", name: "Ann", readOnly: false }],
        families: [],
    };

    const stemmaDescA = { type: "StemmaDescription" as const, id: "a", name: "A", removable: true };
    const stemmaDescB = { type: "StemmaDescription" as const, id: "b", name: "B", removable: true };

    beforeEach(() => {
        localStorage.clear();
    });

    test("uses last stemma id on authenticate and fetches it when not first", async () => {
        const model = {
            listDescribeStemmas: jest.fn().mockResolvedValue({
                stemmas: [stemmaDescA, stemmaDescB],
                firstStemma: stemmaA,
            }),
            getStemma: jest.fn().mockResolvedValue(stemmaB),
        };

        localStorage.setItem("stemma_last_stemma_id", "b");

        const controller = new AppController("http://example", () => model as any);
        controller.authenticateAndListStemmas({ getToken: () => "token", refresh: () => Promise.resolve("token") });
        await drainPromises();

        expect(model.getStemma).toHaveBeenCalledWith("b");
        expect(get(controller.currentStemmaId)).toBe("b");
        expect(get(controller.stemma)).toEqual(stemmaB);
        expect(localStorage.getItem("stemma_last_stemma_id")).toBe("b");
    });

    test("falls back to first stemma when no last id", async () => {
        const model = {
            listDescribeStemmas: jest.fn().mockResolvedValue({
                stemmas: [stemmaDescA, stemmaDescB],
                firstStemma: stemmaA,
            }),
            getStemma: jest.fn().mockResolvedValue(stemmaB),
        };

        const controller = new AppController("http://example", () => model as any);
        controller.authenticateAndListStemmas({ getToken: () => "token", refresh: () => Promise.resolve("token") });
        await drainPromises();

        expect(model.getStemma).not.toHaveBeenCalled();
        expect(get(controller.currentStemmaId)).toBe("a");
        expect(get(controller.stemma)).toEqual(stemmaA);
        expect(localStorage.getItem("stemma_last_stemma_id")).toBe("a");
    });

    test("prefers defaultStemmaId over first when no last id", async () => {
        const model = {
            listDescribeStemmas: jest.fn().mockResolvedValue({
                stemmas: [stemmaDescA, stemmaDescB],
                firstStemma: stemmaA,
                defaultStemmaId: "b",
            }),
            getStemma: jest.fn().mockResolvedValue(stemmaB),
        };

        const controller = new AppController("http://example", () => model as any);
        controller.authenticateAndListStemmas({ getToken: () => "token", refresh: () => Promise.resolve("token") });
        await drainPromises();

        expect(model.getStemma).toHaveBeenCalledWith("b");
        expect(get(controller.currentStemmaId)).toBe("b");
        expect(get(controller.stemma)).toEqual(stemmaB);
        expect(localStorage.getItem("stemma_last_stemma_id")).toBe("b");
    });

    test("lastStemmaId beats defaultStemmaId", async () => {
        const model = {
            listDescribeStemmas: jest.fn().mockResolvedValue({
                stemmas: [stemmaDescA, stemmaDescB],
                firstStemma: stemmaA,
                defaultStemmaId: "b",
            }),
            getStemma: jest.fn(),
        };

        localStorage.setItem("stemma_last_stemma_id", "a");

        const controller = new AppController("http://example", () => model as any);
        controller.authenticateAndListStemmas({ getToken: () => "token", refresh: () => Promise.resolve("token") });
        await drainPromises();

        expect(model.getStemma).not.toHaveBeenCalled();
        expect(get(controller.currentStemmaId)).toBe("a");
    });

    test("empty stemma list leaves controller idle", async () => {
        const model = {
            listDescribeStemmas: jest.fn().mockResolvedValue({
                stemmas: [],
                firstStemma: null,
                defaultStemmaId: null,
            }),
            getStemma: jest.fn(),
        };

        const controller = new AppController("http://example", () => model as any);
        controller.authenticateAndListStemmas({ getToken: () => "token", refresh: () => Promise.resolve("token") });
        await drainPromises();

        expect(model.getStemma).not.toHaveBeenCalled();
        expect(get(controller.currentStemmaId)).toBeNull();
        expect(get(controller.ownedStemmas)).toEqual([]);
    });

    test("selectStemma updates current stemma and stores it", async () => {
        const model = {
            getStemma: jest.fn().mockResolvedValue(stemmaB),
        };

        const controller = new AppController("http://example", () => model as any);
        (controller as any).model = model;

        controller.selectStemma("b");
        await drainPromises();

        expect(model.getStemma).toHaveBeenCalledWith("b");
        expect(get(controller.currentStemmaId)).toBe("b");
        expect(get(controller.stemma)).toEqual(stemmaB);
        expect(localStorage.getItem("stemma_last_stemma_id")).toBe("b");
    });
});
