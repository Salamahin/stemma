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

    test("sends requests with credentials:include and no Authorization header", async () => {
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(200, okStemma));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example");
        await model.getStemma("s");

        const [, init] = fetchMock.mock.calls[0];
        expect((init as RequestInit).credentials).toBe("include");
        const headers = (init as RequestInit).headers as Record<string, string>;
        expect(headers["Authorization"]).toBeUndefined();
    });

    test("throws sessionExpired on 401 without retry", async () => {
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(401));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example");

        await expect(model.getStemma("s")).rejects.toMatchObject({ key: "error.sessionExpired" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("login posts AuthLoginRequest with idToken", async () => {
        const body = { type: "AuthLoginResponse", userId: "u", email: "a@b" };
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(200, body));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example");
        const result = await model.login("abc");

        const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(sent).toEqual({ type: "AuthLoginRequest", idToken: "abc" });
        expect(result).toEqual(body);
    });

    test("logout posts AuthLogoutRequest", async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(fakeResponse(200, { type: "AuthLogoutResponse" }));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example");
        await model.logout();

        const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(sent).toEqual({ type: "AuthLogoutRequest" });
    });

    const unknownPerson: CreateNewPerson = { type: "CreateNewPerson", name: "" };
    const noIndex = null as unknown as StemmaIndex;

    test("createOrphanPerson keeps empty name in payload (Unknown toggle)", async () => {
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(200, okStemma));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example");
        await model.createOrphanPerson("s", unknownPerson);

        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(body.personDescr).toEqual({ name: "", type: "CreateNewPerson" });
    });

    test("updatePerson keeps empty name in payload (Unknown toggle)", async () => {
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(200, okStemma));
        (globalThis as any).fetch = fetchMock;

        const model = new Model("http://example");
        await model.updatePerson("s", "p", unknownPerson, noIndex);

        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(body.personDescr).toEqual({ name: "", type: "CreateNewPerson" });
    });

    test("createFamily preserves empty name on CreateNewPerson, drops empty fields on ExistingPerson", async () => {
        const fetchMock = jest.fn().mockResolvedValue(fakeResponse(200, okStemma));
        (globalThis as any).fetch = fetchMock;
        const existingChild: ExistingPerson = { type: "ExistingPerson", id: "kid" };

        const model = new Model("http://example");
        await model.createFamily("s", [unknownPerson], [existingChild], noIndex);

        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(body.familyDescr.parent1).toEqual({ name: "", type: "CreateNewPerson" });
        expect(body.familyDescr.children[0]).toEqual({ id: "kid", type: "ExistingPerson" });
    });
});
