import { sanitizeRequestPayload } from "./requestSanitizer";

describe("sanitizeRequestPayload", () => {
    test("removes null and empty string fields", () => {
        const input = { name: "Ann", bio: "", birthDate: null, age: 0, active: false };
        expect(sanitizeRequestPayload(input)).toEqual({ name: "Ann", age: 0, active: false });
    });

    test("preserves keys listed in preserveKeys even when empty", () => {
        const input = { name: "", bio: "", birthDate: null };
        expect(sanitizeRequestPayload(input, ["name"])).toEqual({ name: "" });
    });

    test("preserve list is a no-op when the key is absent", () => {
        const input = { id: "abc", bio: "" };
        expect(sanitizeRequestPayload(input, ["name"])).toEqual({ id: "abc" });
    });
});
