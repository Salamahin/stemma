import { get } from "svelte/store";
import { AppController } from "./appController";
import type { CreateNewPerson, Stemma } from "./model";
import { StemmaIndex } from "./stemmaIndex";
import { PinnedPeopleStorage } from "./pinnedPeopleStorage";

function drainPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function drainAll() {
    for (let i = 0; i < 6; i++) await drainPromises();
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

    describe("savePerson", () => {
        const stemmaId = "s1";
        const personId = "p1";
        const baseStemma: Stemma = {
            type: "Stemma",
            people: [
                {
                    type: "PersonDescription",
                    id: personId,
                    name: "Bob",
                    birthDate: null,
                    deathDate: null,
                    bio: "",
                    readOnly: false,
                } as any,
            ],
            families: [],
        };
        const updatedStemma: Stemma = {
            ...baseStemma,
            people: [{ ...baseStemma.people[0], name: "Bobby" } as any],
        };
        const sameDescr: CreateNewPerson = {
            type: "CreateNewPerson",
            name: "Bob",
            birthDate: null,
            deathDate: null,
            bio: "",
        } as any;
        const changedDescr: CreateNewPerson = {
            ...sameDescr,
            name: "Bobby",
        };

        function makeController(model: any) {
            const c = new AppController("http://example", () => model as any);
            (c as any).model = model;
            c.currentStemmaId.set(stemmaId);
            c.stemmaIndex.set(new StemmaIndex(baseStemma));
            c.pinnedStorage.set(new PinnedPeopleStorage(stemmaId));
            return c;
        }

        test("no-op when nothing changed", async () => {
            const model = {
                requestPhotoUploadUrl: jest.fn(),
                uploadPhotoToPresignedUrl: jest.fn(),
                setPersonPhoto: jest.fn(),
                updatePerson: jest.fn(),
            };
            const c = makeController(model);
            c.savePerson(personId, sameDescr, false, null, false);
            await drainAll();
            expect(model.requestPhotoUploadUrl).not.toHaveBeenCalled();
            expect(model.setPersonPhoto).not.toHaveBeenCalled();
            expect(model.updatePerson).not.toHaveBeenCalled();
        });

        test("only fields changed: just updatePerson", async () => {
            const model = {
                requestPhotoUploadUrl: jest.fn(),
                uploadPhotoToPresignedUrl: jest.fn(),
                setPersonPhoto: jest.fn(),
                updatePerson: jest.fn().mockResolvedValue(updatedStemma),
            };
            const c = makeController(model);
            c.savePerson(personId, changedDescr, false, null, false);
            await drainAll();
            expect(model.updatePerson).toHaveBeenCalledTimes(1);
            expect(model.setPersonPhoto).not.toHaveBeenCalled();
            expect(model.requestPhotoUploadUrl).not.toHaveBeenCalled();
        });

        test("only photo upload (no field change): upload chain, no updatePerson", async () => {
            const model = {
                requestPhotoUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "u", photoKey: "k" }),
                uploadPhotoToPresignedUrl: jest.fn().mockResolvedValue(undefined),
                setPersonPhoto: jest.fn().mockResolvedValue(baseStemma),
                updatePerson: jest.fn(),
            };
            const c = makeController(model);
            const blob = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
            c.savePerson(personId, sameDescr, false, blob, false);
            await drainAll();
            expect(model.requestPhotoUploadUrl).toHaveBeenCalledWith(stemmaId, personId, "image/jpeg");
            expect(model.uploadPhotoToPresignedUrl).toHaveBeenCalledWith("u", blob);
            expect(model.setPersonPhoto).toHaveBeenCalledWith(stemmaId, personId, "k", expect.anything());
            expect(model.updatePerson).not.toHaveBeenCalled();
        });

        test("photo upload + fields: upload finishes before updatePerson", async () => {
            const order: string[] = [];
            const model = {
                requestPhotoUploadUrl: jest.fn().mockImplementation(async () => {
                    order.push("requestPhotoUploadUrl");
                    return { uploadUrl: "u", photoKey: "k" };
                }),
                uploadPhotoToPresignedUrl: jest.fn().mockImplementation(async () => {
                    order.push("uploadPhotoToPresignedUrl");
                }),
                setPersonPhoto: jest.fn().mockImplementation(async () => {
                    order.push("setPersonPhoto");
                    return baseStemma;
                }),
                updatePerson: jest.fn().mockImplementation(async () => {
                    order.push("updatePerson");
                    return updatedStemma;
                }),
            };
            const c = makeController(model);
            const blob = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
            c.savePerson(personId, changedDescr, false, blob, false);
            await drainAll();
            expect(order).toEqual([
                "requestPhotoUploadUrl",
                "uploadPhotoToPresignedUrl",
                "setPersonPhoto",
                "updatePerson",
            ]);
        });

        test("photo remove + fields: setPersonPhoto(null) before updatePerson", async () => {
            const order: string[] = [];
            const model = {
                requestPhotoUploadUrl: jest.fn(),
                uploadPhotoToPresignedUrl: jest.fn(),
                setPersonPhoto: jest.fn().mockImplementation(async (_sid: string, _pid: string, key: string | null) => {
                    order.push(`setPersonPhoto:${key}`);
                    return baseStemma;
                }),
                updatePerson: jest.fn().mockImplementation(async () => {
                    order.push("updatePerson");
                    return updatedStemma;
                }),
            };
            const c = makeController(model);
            c.savePerson(personId, changedDescr, false, null, true);
            await drainAll();
            expect(model.requestPhotoUploadUrl).not.toHaveBeenCalled();
            expect(order).toEqual(["setPersonPhoto:null", "updatePerson"]);
        });

        test("only photo remove: setPersonPhoto(null), no updatePerson", async () => {
            const model = {
                requestPhotoUploadUrl: jest.fn(),
                uploadPhotoToPresignedUrl: jest.fn(),
                setPersonPhoto: jest.fn().mockResolvedValue(baseStemma),
                updatePerson: jest.fn(),
            };
            const c = makeController(model);
            c.savePerson(personId, sameDescr, false, null, true);
            await drainAll();
            expect(model.setPersonPhoto).toHaveBeenCalledWith(stemmaId, personId, null, expect.anything());
            expect(model.updatePerson).not.toHaveBeenCalled();
        });

        test("photoUpload wins over photoRemove when both flags are set", async () => {
            const model = {
                requestPhotoUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "u", photoKey: "k" }),
                uploadPhotoToPresignedUrl: jest.fn().mockResolvedValue(undefined),
                setPersonPhoto: jest.fn().mockResolvedValue(baseStemma),
                updatePerson: jest.fn(),
            };
            const c = makeController(model);
            const blob = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
            c.savePerson(personId, sameDescr, false, blob, true);
            await drainAll();
            expect(model.setPersonPhoto).toHaveBeenCalledWith(stemmaId, personId, "k", expect.anything());
            expect(model.setPersonPhoto).not.toHaveBeenCalledWith(stemmaId, personId, null, expect.anything());
        });

        test("updatePerson is skipped when photo step fails", async () => {
            const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const model = {
                requestPhotoUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "u", photoKey: "k" }),
                uploadPhotoToPresignedUrl: jest.fn().mockRejectedValue(new Error("boom")),
                setPersonPhoto: jest.fn(),
                updatePerson: jest.fn(),
            };
            const c = makeController(model);
            const blob = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
            c.savePerson(personId, changedDescr, false, blob, false);
            await drainAll();
            expect(model.setPersonPhoto).not.toHaveBeenCalled();
            expect(model.updatePerson).not.toHaveBeenCalled();
            expect(get(c.err)).toBeInstanceOf(Error);
            errSpy.mockRestore();
        });
    });
});
