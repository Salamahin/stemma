import { describe, expect, it } from "@jest/globals";
import type { PersonDescription } from "./model";
import { highlightMatches, normalizeRu, searchPeople } from "./personSearch";

function person(id: string, name: string): PersonDescription {
    return { type: "PersonDescription", id, name, readOnly: false };
}

describe("normalizeRu", () => {
    it("lowercases", () => {
        expect(normalizeRu("Иван")).toBe("иван");
    });

    it("replaces ё with е", () => {
        expect(normalizeRu("Фёдор")).toBe("федор");
    });

    it("replaces й with и", () => {
        expect(normalizeRu("Андрей")).toBe("андреи");
    });

    it("preserves length", () => {
        const input = "Фёдор Прокопьевич Алексей";
        expect(normalizeRu(input).length).toBe(input.length);
    });
});

describe("searchPeople", () => {
    it("returns empty for queries shorter than 2 chars", () => {
        expect(searchPeople("a", [person("1", "Alice")])).toEqual([]);
    });

    it("finds Фёдор when querying Федор", () => {
        const ids = searchPeople("Федор", [
            person("1", "Фёдор Иванов"),
            person("2", "Иван Петров"),
        ]).map((r) => r.item.id);
        expect(ids).toEqual(["1"]);
    });

    it("finds Федор when querying Фёдор", () => {
        const ids = searchPeople("Фёдор", [
            person("1", "Федор Иванов"),
            person("2", "Иван Петров"),
        ]).map((r) => r.item.id);
        expect(ids).toEqual(["1"]);
    });

    it("finds Фёдор when querying full name with case mismatch", () => {
        const ids = searchPeople("федор", [person("1", "Фёдор Иванов")]).map(
            (r) => r.item.id,
        );
        expect(ids).toEqual(["1"]);
    });

    it("tolerates patronymic variants Прокопьевич/Прокопиевич/Прокопивич", () => {
        const people = [
            person("1", "Иван Прокопьевич"),
            person("2", "Иван Прокопиевич"),
            person("3", "Иван Прокопивич"),
            person("4", "Пётр Сидоров"),
        ];
        const ids = searchPeople("Прокопиевич", people).map((r) => r.item.id);
        expect(ids).toEqual(expect.arrayContaining(["1", "2", "3"]));
        expect(ids).not.toContain("4");
    });

    it("ignores unrelated names", () => {
        const ids = searchPeople("Иван", [
            person("1", "Иван Иванов"),
            person("2", "Мария Сидорова"),
        ]).map((r) => r.item.id);
        expect(ids).toEqual(["1"]);
    });

    it("finds Иван when querying Latin Ivan", () => {
        const ids = searchPeople("Ivan", [
            person("1", "Иван Иванов"),
            person("2", "Пётр Сидоров"),
        ]).map((r) => r.item.id);
        expect(ids).toContain("1");
        expect(ids).not.toContain("2");
    });

    it("finds Latin Ivan when querying Иван", () => {
        const ids = searchPeople("Иван", [
            person("1", "Ivan Petrov"),
            person("2", "John Smith"),
        ]).map((r) => r.item.id);
        expect(ids).toContain("1");
        expect(ids).not.toContain("2");
    });

    it("matches Юрий via Latin yuriy", () => {
        const ids = searchPeople("yuriy", [
            person("1", "Юрий Гагарин"),
            person("2", "Сергей Королёв"),
        ]).map((r) => r.item.id);
        expect(ids).toContain("1");
        expect(ids).not.toContain("2");
    });

    it("matches Фёдор via Latin Fedor", () => {
        const ids = searchPeople("Fedor", [
            person("1", "Фёдор Достоевский"),
            person("2", "Лев Толстой"),
        ]).map((r) => r.item.id);
        expect(ids).toContain("1");
        expect(ids).not.toContain("2");
    });

    it("respects the limit", () => {
        const people = Array.from({ length: 20 }, (_, i) =>
            person(String(i), `Иван ${i}`),
        );
        expect(searchPeople("Иван", people, 3)).toHaveLength(3);
    });

    it("returns match indices into the original name", () => {
        const [result] = searchPeople("Фёдор", [person("1", "Фёдор Иванов")]);
        expect(result.matchedIndices.length).toBeGreaterThan(0);
        for (const [start, end] of result.matchedIndices) {
            expect(start).toBeGreaterThanOrEqual(0);
            expect(end).toBeLessThan("Фёдор Иванов".length);
        }
    });
});

describe("highlightMatches", () => {
    it("wraps matched ranges in <b>", () => {
        expect(highlightMatches("Федор", [[0, 4]])).toBe("<b>Федор</b>");
    });

    it("escapes HTML in unmatched portions", () => {
        expect(highlightMatches("<bad>", [])).toBe("&lt;bad&gt;");
    });

    it("returns escaped name when no matches", () => {
        expect(highlightMatches("Иван", [])).toBe("Иван");
    });

    it("interleaves matched and unmatched segments", () => {
        expect(highlightMatches("Фёдор Иванов", [[0, 4]])).toBe(
            "<b>Фёдор</b> Иванов",
        );
    });
});
