import { Model, type CreateNewPerson, type ExistingPerson } from "./model";
import type { StemmaIndex } from "./stemmaIndex";

function fakeResponse(status: number, body: unknown = {}) {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
    } as unknown as Response;
}

describe("Model", () => {
    const okStemma = { type: "Stemma", people: [], families: [] };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("retries once after 401 using a freshly refreshed token", async () => {
        let calls = 0;
        const refresh = jest.fn().mockResolvedValue("new-token");
        const fetchMock = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
            calls += 1;
            const auth = (init.headers as Record<string, string>)["Authorization"];
            if (calls === 1) {
                expect(auth).toBe("Bearer old-token");
                return fakeResponse(401);
            }
            expect(auth).toBe("Bearer new-token");
            return fakeResponse(200, okStemma);
        });
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example", {
            getToken: () => "old-token",
            refresh,
        });

        const result = await model.getStemma("s");
        expect(result).toEqual(okStemma);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("throws sessionExpired when refresh fails", async () => {
        const refresh = jest.fn().mockRejectedValue(new Error("nope"));
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(401));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example", {
            getToken: () => "old-token",
            refresh,
        });

        await expect(model.getStemma("s")).rejects.toMatchObject({ key: "error.sessionExpired" });
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("throws sessionExpired when refreshed token still gets 401", async () => {
        const refresh = jest.fn().mockResolvedValue("new-token");
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(401));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example", {
            getToken: () => "old-token",
            refresh,
        });

        await expect(model.getStemma("s")).rejects.toMatchObject({ key: "error.sessionExpired" });
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const unknownPerson: CreateNewPerson = { type: "CreateNewPerson", name: "" };
    const noIndex = null as unknown as StemmaIndex;

    test("createOrphanPerson keeps empty name in payload (Unknown toggle)", async () => {
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(200, okStemma));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example", { getToken: () => "tok", refresh: jest.fn() });
        await model.createOrphanPerson("s", unknownPerson);

        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(body.personDescr).toEqual({ name: "", type: "CreateNewPerson" });
    });

    test("updatePerson keeps empty name in payload (Unknown toggle)", async () => {
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(200, okStemma));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example", { getToken: () => "tok", refresh: jest.fn() });
        await model.updatePerson("s", "p", unknownPerson, noIndex);

        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(body.personDescr).toEqual({ name: "", type: "CreateNewPerson" });
    });

    test("createFamily preserves empty name on CreateNewPerson, drops empty fields on ExistingPerson", async () => {
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(200, okStemma));
        (globalThis as any).fetch = fetchMock;
        const existingChild: ExistingPerson = { type: "ExistingPerson", id: "kid" };

        const model = new Model("http://example", { getToken: () => "tok", refresh: jest.fn() });
        await model.createFamily("s", [unknownPerson], [existingChild], noIndex);

        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(body.familyDescr.parent1).toEqual({ name: "", type: "CreateNewPerson" });
        expect(body.familyDescr.children[0]).toEqual({ id: "kid", type: "ExistingPerson" });
    });
});
