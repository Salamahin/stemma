import { get } from "svelte/store";
import { AppController } from "./appController";
import type { Stemma } from "./model";

function drainPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("AppController", () => {
    const stemmaA: Stemma = { people: [], families: [] };
    const stemmaB: Stemma = { people: [{ id: "1", name: "Ann", readOnly: false }], families: [] };

    beforeEach(() => {
        localStorage.clear();
    });

    test("uses last stemma id on authenticate and fetches it when not first", async () => {
        const model = {
            listDescribeStemmas: jest.fn().mockResolvedValue({
                stemmas: [
                    { id: "a", name: "A", removable: true },
                    { id: "b", name: "B", removable: true },
                ],
                firstStemma: stemmaA,
            }),
            getStemma: jest.fn().mockResolvedValue(stemmaB),
        };

        localStorage.setItem("stemma_last_stemma_id", "b");

        const controller = new AppController("http://example", () => model as any);
        controller.authenticateAndListStemmas({ id_token: "token" });
        await drainPromises();

        expect(model.getStemma).toHaveBeenCalledWith("b");
        expect(get(controller.currentStemmaId)).toBe("b");
        expect(get(controller.stemma)).toEqual(stemmaB);
        expect(localStorage.getItem("stemma_last_stemma_id")).toBe("b");
    });

    test("falls back to first stemma when no last id", async () => {
        const model = {
            listDescribeStemmas: jest.fn().mockResolvedValue({
                stemmas: [
                    { id: "a", name: "A", removable: true },
                    { id: "b", name: "B", removable: true },
                ],
                firstStemma: stemmaA,
            }),
            getStemma: jest.fn().mockResolvedValue(stemmaB),
        };

        const controller = new AppController("http://example", () => model as any);
        controller.authenticateAndListStemmas({ id_token: "token" });
        await drainPromises();

        expect(model.getStemma).not.toHaveBeenCalled();
        expect(get(controller.currentStemmaId)).toBe("a");
        expect(get(controller.stemma)).toEqual(stemmaA);
        expect(localStorage.getItem("stemma_last_stemma_id")).toBe("a");
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
