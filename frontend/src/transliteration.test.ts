import { describe, expect, it } from "@jest/globals";
import { hasCyrillic, toLatinVariants } from "./transliteration";

describe("hasCyrillic", () => {
    it("detects Cyrillic letters", () => {
        expect(hasCyrillic("Иван")).toBe(true);
        expect(hasCyrillic("Иван Petrov")).toBe(true);
    });

    it("returns false for Latin-only strings", () => {
        expect(hasCyrillic("Ivan Petrov")).toBe(false);
        expect(hasCyrillic("")).toBe(false);
    });
});

describe("toLatinVariants", () => {
    it("collapses Иван to ivan across all schemes", () => {
        expect(toLatinVariants("Иван")).toEqual(["ivan"]);
    });

    it("returns multiple forms for ambiguous Юрий", () => {
        const variants = toLatinVariants("Юрий");
        expect(variants).toEqual(expect.arrayContaining(["iurii", "yuriy"]));
    });

    it("renders ё as both e and yo", () => {
        const variants = toLatinVariants("Фёдор");
        expect(variants).toEqual(expect.arrayContaining(["fedor", "fyodor"]));
    });

    it("renders х as kh and h", () => {
        const variants = toLatinVariants("Хабаров");
        expect(variants).toEqual(expect.arrayContaining(["khabarov", "habarov"]));
    });

    it("strips ь and ъ", () => {
        const variants = toLatinVariants("Прокопьевич");
        for (const v of variants) expect(v).not.toContain("ь");
    });

    it("preserves spaces and Latin segments", () => {
        const variants = toLatinVariants("Иван Петров");
        expect(variants.every((v) => v.includes(" "))).toBe(true);
    });

    it("lowercases Latin input and returns a single variant", () => {
        expect(toLatinVariants("Ivan")).toEqual(["ivan"]);
    });

    it("returns empty-string variant for empty input", () => {
        expect(toLatinVariants("")).toEqual([""]);
    });
});
