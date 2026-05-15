import { clearCredential, loadCredential, saveCredential } from "./credentialStorage";

function makeToken(expSeconds: number): string {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");
    return `${header}.${payload}.`;
}

describe("credentialStorage", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("returns null when nothing is stored", () => {
        expect(loadCredential()).toBeNull();
    });

    test("saveCredential persists token and exposes expiry", () => {
        const expSeconds = Math.floor(Date.now() / 1000) + 3600;
        const token = makeToken(expSeconds);

        const saved = saveCredential(token);

        expect(saved).not.toBeNull();
        expect(saved!.token).toBe(token);
        expect(saved!.expiresAt).toBe(expSeconds * 1000);
        expect(localStorage.getItem("stemma_credential")).toBe(token);
    });

    test("loadCredential returns the stored token while it is fresh", () => {
        const expSeconds = Math.floor(Date.now() / 1000) + 3600;
        const token = makeToken(expSeconds);
        saveCredential(token);

        const loaded = loadCredential();

        expect(loaded).not.toBeNull();
        expect(loaded!.token).toBe(token);
        expect(loaded!.expiresAt).toBe(expSeconds * 1000);
    });

    test("loadCredential discards tokens that are already expired", () => {
        const token = makeToken(Math.floor(Date.now() / 1000) - 60);
        localStorage.setItem("stemma_credential", token);

        expect(loadCredential()).toBeNull();
        expect(localStorage.getItem("stemma_credential")).toBeNull();
    });

    test("loadCredential discards tokens that fall inside the safety buffer", () => {
        const now = Date.now();
        const token = makeToken(Math.floor((now + 30_000) / 1000));
        localStorage.setItem("stemma_credential", token);

        expect(loadCredential(now)).toBeNull();
        expect(localStorage.getItem("stemma_credential")).toBeNull();
    });

    test("loadCredential clears unparseable tokens", () => {
        localStorage.setItem("stemma_credential", "not-a-jwt");

        expect(loadCredential()).toBeNull();
        expect(localStorage.getItem("stemma_credential")).toBeNull();
    });

    test("clearCredential removes the stored token", () => {
        const token = makeToken(Math.floor(Date.now() / 1000) + 3600);
        saveCredential(token);

        clearCredential();

        expect(localStorage.getItem("stemma_credential")).toBeNull();
    });
});
