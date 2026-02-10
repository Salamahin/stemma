import { getInitialLocale, interpolate } from "./i18n";

describe("i18n", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("getInitialLocale defaults to en", () => {
        expect(getInitialLocale()).toBe("en");
    });

    test("getInitialLocale reads stored value", () => {
        localStorage.setItem("stemma_locale", "ru");
        expect(getInitialLocale()).toBe("ru");
    });

    test("interpolate fills params and keeps missing keys", () => {
        expect(interpolate("Hello {name}", { name: "Ann" })).toBe("Hello Ann");
        expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
    });
});
