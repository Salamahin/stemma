import { readFileSync } from "fs";
import { join } from "path";
import { en, getInitialLocale, interpolate, ru } from "./i18n";

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

describe("About texts", () => {
    const aboutKeys = (dict: Record<string, string>) => Object.keys(dict).filter((k) => k.startsWith("about.")).sort();

    test("en and ru describe the same About sections", () => {
        expect(aboutKeys(ru)).toEqual(aboutKeys(en));
    });

    test("every key the About modal renders exists in both languages", () => {
        const source = readFileSync(join(__dirname, "components/AboutModal.svelte"), "utf8");
        const used = [...source.matchAll(/["'](about\.[\w.]+)["']/g)].map((m) => m[1]);
        expect(used.length).toBeGreaterThan(0);
        for (const key of used) {
            expect(en[key]).toBeTruthy();
            expect(ru[key]).toBeTruthy();
        }
    });

    test("the cycle rule does not forbid marrying a relative", () => {
        // Only a directed parent → child cycle is rejected (stemma_dfs.has_cycles).
        expect(en["about.rule8"]).toMatch(/own ancestor/);
        expect(ru["about.rule8"]).toMatch(/собственным предком/);
    });
});
