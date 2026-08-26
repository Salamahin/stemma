import type { Model } from "./model";
import { Session } from "./session";
import { hasSessionHint } from "./sessionHint";

function fakeModel(): Model {
    return {
        login: jest.fn().mockResolvedValue({}),
        logout: jest.fn().mockResolvedValue({}),
    } as unknown as Model;
}

function ref(initial: boolean) {
    let value = initial;
    return { get: () => value, set: (v: boolean) => (value = v) };
}

describe("Session", () => {
    beforeEach(() => localStorage.clear());

    test("stays signed out until the loader has the data", async () => {
        const signedIn = ref(false);
        let releaseLoad: (ok: boolean) => void;
        const loaded = new Promise<boolean>((resolve) => (releaseLoad = resolve));
        const session = new Session(fakeModel(), signedIn, () => loaded);

        const signingIn = session.signIn("id-token");
        await Promise.resolve();
        expect(signedIn.get()).toBe(false);

        releaseLoad!(true);
        await signingIn;
        expect(signedIn.get()).toBe(true);
    });

    test("does not sign in when the loader rejects the fresh session", async () => {
        const signedIn = ref(false);
        const session = new Session(fakeModel(), signedIn, async () => false);

        await session.signIn("id-token");

        expect(signedIn.get()).toBe(false);
    });

    test("remembers the session so the next boot waits for the probe", async () => {
        const session = new Session(fakeModel(), ref(false), async () => true);

        await session.signIn("id-token");

        expect(hasSessionHint()).toBe(true);
    });

    test("forgets the session on sign-out", async () => {
        const signedIn = ref(false);
        const session = new Session(fakeModel(), signedIn, async () => true);
        await session.signIn("id-token");

        await session.signOut();

        expect(signedIn.get()).toBe(false);
        expect(hasSessionHint()).toBe(false);
    });

    test("forgets the session when the cookie turns out to be stale", async () => {
        const session = new Session(fakeModel(), ref(true), async () => true);
        localStorage.setItem("stemma_has_session", "1");

        session.markSignedOut();

        expect(hasSessionHint()).toBe(false);
    });
});
