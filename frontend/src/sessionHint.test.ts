import { forgetSession, hasSessionHint, rememberSession } from "./sessionHint";

describe("sessionHint", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
    });

    test("is absent until a session is remembered", () => {
        expect(hasSessionHint()).toBe(false);
        rememberSession();
        expect(hasSessionHint()).toBe(true);
    });

    test("is dropped on forget", () => {
        rememberSession();
        forgetSession();
        expect(hasSessionHint()).toBe(false);
    });

    test("reports no hint when storage is unavailable", () => {
        jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(hasSessionHint()).toBe(false);
    });

    test("survives storage writes being denied", () => {
        jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("denied");
        });
        expect(() => rememberSession()).not.toThrow();
    });
});
