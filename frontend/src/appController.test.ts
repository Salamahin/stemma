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

        const controller = new AppController("http://example", model as any);
        await controller.listStemmas();
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

        const controller = new AppController("http://example", model as any);
        await controller.listStemmas();
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

        const controller = new AppController("http://example", model as any);
        await controller.listStemmas();
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

        const controller = new AppController("http://example", model as any);
        await controller.listStemmas();
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

        const controller = new AppController("http://example", model as any);
        await controller.listStemmas();
        await drainPromises();

        expect(model.getStemma).not.toHaveBeenCalled();
        expect(get(controller.currentStemmaId)).toBeNull();
        expect(get(controller.ownedStemmas)).toEqual([]);
    });

    test("selectStemma updates current stemma and stores it", async () => {
        const model = {
            getStemma: jest.fn().mockResolvedValue(stemmaB),
        };

        const controller = new AppController("http://example", model as any);
        (controller as any).model = model;

        controller.selectStemma("b");
        await drainPromises();

        expect(model.getStemma).toHaveBeenCalledWith("b");
        expect(get(controller.currentStemmaId)).toBe("b");
        expect(get(controller.stemma)).toEqual(stemmaB);
        expect(localStorage.getItem("stemma_last_stemma_id")).toBe("b");
    });

    test("selectStemma toggles isWorking when switching to a different stemma", async () => {
        let resolveFetch: (s: Stemma) => void;
        const model = {
            getStemma: jest.fn().mockReturnValue(new Promise<Stemma>((r) => { resolveFetch = r; })),
        };
        const controller = new AppController("http://example", model as any);
        (controller as any).model = model;
        controller.currentStemmaId.set("a");

        controller.selectStemma("b");
        expect(get(controller.isWorking)).toBe(true);

        resolveFetch!(stemmaB);
        await drainPromises();
        expect(get(controller.isWorking)).toBe(false);
    });

    test("selectStemma does not toggle isWorking when re-fetching the same stemma", async () => {
        let resolveFetch: (s: Stemma) => void;
        const model = {
            getStemma: jest.fn().mockReturnValue(new Promise<Stemma>((r) => { resolveFetch = r; })),
        };
        const controller = new AppController("http://example", model as any);
        (controller as any).model = model;
        controller.currentStemmaId.set("b");

        controller.selectStemma("b");
        expect(get(controller.isWorking)).toBe(false);

        resolveFetch!(stemmaB);
        await drainPromises();
        expect(get(controller.isWorking)).toBe(false);
        expect(get(controller.stemma)).toEqual(stemmaB);
    });

    describe("silent mutations", () => {
        const stemmaId = "s1";
        const baseStemma: Stemma = { type: "Stemma", people: [], families: [] };

        function makeController(model: any) {
            const c = new AppController("http://example", model as any);
            (c as any).model = model;
            c.currentStemmaId.set(stemmaId);
            c.stemmaIndex.set(new StemmaIndex(baseStemma));
            return c;
        }

        test("createOrphanPerson with silent leaves isWorking false and returns a promise", async () => {
            let resolveMut: (s: Stemma) => void;
            const model = {
                createOrphanPerson: jest.fn().mockReturnValue(new Promise<Stemma>((r) => { resolveMut = r; })),
            };
            const c = makeController(model);

            const p = c.createOrphanPerson({ type: "CreateNewPerson", name: "x" }, { silent: true });
            expect(get(c.isWorking)).toBe(false);

            resolveMut!(stemmaB);
            await p;
            expect(get(c.isWorking)).toBe(false);
            expect(get(c.stemma)).toEqual(stemmaB);
        });

        test("linkPersons forwards role and stemma index to the model", async () => {
            let resolveMut: (s: Stemma) => void;
            const linkPersons = jest.fn().mockReturnValue(new Promise<Stemma>((r) => { resolveMut = r; }));
            const model = { linkPersons };
            const c = makeController(model);

            const p = c.linkPersons("a", "b", "spouse", { silent: true });
            expect(get(c.isWorking)).toBe(false);
            expect(linkPersons).toHaveBeenCalledWith(stemmaId, "a", "b", "spouse", expect.any(StemmaIndex));

            resolveMut!(stemmaB);
            await p;
            expect(get(c.stemma)).toEqual(stemmaB);
        });

        test("createOrphanPerson without silent toggles isWorking", async () => {
            let resolveMut: (s: Stemma) => void;
            const model = {
                createOrphanPerson: jest.fn().mockReturnValue(new Promise<Stemma>((r) => { resolveMut = r; })),
            };
            const c = makeController(model);

            const p = c.createOrphanPerson({ type: "CreateNewPerson", name: "x" });
            expect(get(c.isWorking)).toBe(true);

            resolveMut!(stemmaB);
            await p;
            expect(get(c.isWorking)).toBe(false);
        });

        test("silent mutation rejection propagates to caller", async () => {
            const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const boom = new Error("boom");
            const model = {
                removePerson: jest.fn().mockRejectedValue(boom),
            };
            const c = makeController(model);

            await expect(c.removePerson("p1", { silent: true })).rejects.toBe(boom);
            expect(get(c.err)).toBe(boom);
            expect(get(c.isWorking)).toBe(false);
            errSpy.mockRestore();
        });
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
            const c = new AppController("http://example", model as any);
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
                requestPhotoUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "u", uploadFields: {}, photoKey: "k" }),
                uploadPhotoToPresignedUrl: jest.fn().mockResolvedValue(undefined),
                setPersonPhoto: jest.fn().mockResolvedValue(baseStemma),
                updatePerson: jest.fn(),
            };
            const c = makeController(model);
            const blob = new Blob([new Uint8Array([1])], { type: "image/jpeg" });
            c.savePerson(personId, sameDescr, false, blob, false);
            await drainAll();
            expect(model.requestPhotoUploadUrl).toHaveBeenCalledWith(stemmaId, personId, "image/jpeg");
            expect(model.uploadPhotoToPresignedUrl).toHaveBeenCalledWith("u", {}, blob);
            expect(model.setPersonPhoto).toHaveBeenCalledWith(stemmaId, personId, "k", expect.anything());
            expect(model.updatePerson).not.toHaveBeenCalled();
        });

        test("photo upload + fields: upload finishes before updatePerson", async () => {
            const order: string[] = [];
            const model = {
                requestPhotoUploadUrl: jest.fn().mockImplementation(async () => {
                    order.push("requestPhotoUploadUrl");
                    return { uploadUrl: "u", uploadFields: {}, photoKey: "k" };
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
                requestPhotoUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "u", uploadFields: {}, photoKey: "k" }),
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
                requestPhotoUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "u", uploadFields: {}, photoKey: "k" }),
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
