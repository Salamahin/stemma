import { sanitizeRequestPayload } from "./requestSanitizer";

describe("sanitizeRequestPayload", () => {
    test("removes null and empty string fields", () => {
        const input = { name: "Ann", bio: "", birthDate: null, age: 0, active: false };
        expect(sanitizeRequestPayload(input)).toEqual({ name: "Ann", age: 0, active: false });
    });
});
