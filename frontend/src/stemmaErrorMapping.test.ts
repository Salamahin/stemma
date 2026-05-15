import { LocalizedError } from "./i18n";
import { mapStemmaError } from "./stemmaErrorMapping";

describe("mapStemmaError", () => {
    const describePerson = (id: string) => `[${id}]`;

    test("maps unknown error", () => {
        expect(() => mapStemmaError({ type: "UnknownError", cause: "x" }, describePerson)).toThrow(LocalizedError);
        try {
            mapStemmaError({ type: "UnknownError", cause: "x" }, describePerson);
        } catch (err: any) {
            expect(err.key).toBe("error.unknown");
        }
    });

    test("maps NoSuchPersonId with name param", () => {
        try {
            mapStemmaError({ type: "NoSuchPersonId", id: "p1" }, describePerson);
        } catch (err: any) {
            expect(err.key).toBe("error.noSuchPerson");
            expect(err.params).toEqual({ name: "[p1]" });
        }
    });

    test("returns response when no error", () => {
        const response = { type: "Stemma" as const, people: [], families: [] };
        expect(mapStemmaError(response, describePerson)).toBe(response);
    });
});
