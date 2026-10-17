import { isUnknownPerson, personDisplayName, UNKNOWN_PERSON } from "./personDisplayName";

describe("personDisplayName", () => {
    test("an unknown person is shown as ??? in every language", () => {
        expect(UNKNOWN_PERSON).toBe("???");
        expect(personDisplayName(null)).toBe("???");
        expect(personDisplayName("")).toBe("???");
        expect(personDisplayName("   ")).toBe("???");
    });

    test.each([
        "Unknown",
        "unknown",
        "Неизвестно",
        "Неизвестный",
        "неизвестная",
        "(имя неизвестно)",
        "Имя неизвестно",
        "?",
        "???",
    ])("placeholder name %p is treated as unknown", (name) => {
        expect(isUnknownPerson(name)).toBe(true);
        expect(personDisplayName(name)).toBe("???");
    });

    test("only the unknown part of a partly known name is replaced", () => {
        expect(personDisplayName("Неизвестно Степанович")).toBe("??? Степанович");
        expect(personDisplayName("Саломахин ? Степанович")).toBe("Саломахин ??? Степанович");
        expect(isUnknownPerson("Неизвестно Степанович")).toBe(false);
    });

    test("real names are left alone", () => {
        expect(personDisplayName("Саломахина Ирина Ивановна")).toBe("Саломахина Ирина Ивановна");
        expect(personDisplayName("Неизвестнов Пётр")).toBe("Неизвестнов Пётр");
        expect(isUnknownPerson("Иван")).toBe(false);
    });
});
