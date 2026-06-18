import { clanColor, computeClans, nameTokens } from "./clans";
import type { FamilyDescription, PersonDescription, Stemma } from "./model";

const person = (id: string, name: string): PersonDescription => ({
    type: "PersonDescription", id, name, readOnly: false,
});
const family = (id: string, parents: string[], children: string[]): FamilyDescription => ({
    type: "FamilyDescription", id, parents, children, readOnly: false,
});
const stemma = (people: PersonDescription[], families: FamilyDescription[]): Stemma => ({
    type: "Stemma", people, families,
});

describe("nameTokens", () => {
    test("drops common first names and titles, keeps dynastic surname", () => {
        expect(nameTokens("Михаил Романов")).toEqual(["Романов"]);
    });
    test("strips Roman numerals (and common given names)", () => {
        expect(nameTokens("Иван IV Грозный")).toEqual(["Грозный"]);
    });
    test("drops tokens shorter than 3 chars", () => {
        expect(nameTokens("Ян К Петров")).toEqual(["Петров"]);
    });
    test("canonicalizes feminine surname forms to masculine", () => {
        expect(nameTokens("Анна Сидорова")).toEqual(["Сидоров"]);
        expect(nameTokens("Мария Достоевская")).toEqual(["Достоевский"]);
    });
    test("empty / nullish", () => {
        expect(nameTokens("")).toEqual([]);
        expect(nameTokens(null)).toEqual([]);
        expect(nameTokens(undefined)).toEqual([]);
    });
    test("deduplicates repeats", () => {
        expect(nameTokens("Петров Петров Кузнецов")).toEqual(["Петров", "Кузнецов"]);
    });
});

describe("clanColor", () => {
    test("stable per surname", () => {
        expect(clanColor("Иванов")).toBe(clanColor("Иванов"));
    });
    test("different surnames yield different hues", () => {
        expect(clanColor("Иванов")).not.toBe(clanColor("Сидоров"));
    });
});

describe("computeClans (≥6 carriers, ≥3-generation chain)", () => {
    // Helper: build a 3-generation chain of 6 same-surname people
    const dynastySix = (sur: string, suffix: string = "ов") => {
        const fem = sur + (suffix === "ов" ? "а" : "ая");
        const g1m = person("g1m", `Дед ${sur}`);
        const g1f = person("g1f", `Бабка ${fem}`);
        const g2m = person("g2m", `Отец ${sur}`);
        const g2f = person("g2f", `Мать ${fem}`);
        const g3a = person("g3a", `Сын ${sur}`);
        const g3b = person("g3b", `Дочь ${fem}`);
        const f1 = family("f1", ["g1m", "g1f"], ["g2m"]);
        const f2 = family("f2", ["g2m", "g2f"], ["g3a", "g3b"]);
        return { people: [g1m, g1f, g2m, g2f, g3a, g3b], families: [f1, f2] };
    };

    test("six members across three generations all sharing a surname → clan", () => {
        const { people, families } = dynastySix("Сидоров");
        const clans = computeClans(stemma(people, families));
        expect(clans).toHaveLength(1);
        expect(clans[0].surname).toBe("Сидоров");
        expect(clans[0].personIds.size).toBe(6);
    });

    test("fewer than 6 carriers → no clan", () => {
        const a = person("a", "Иван Сидоров");
        const b = person("b", "Анна Сидорова");
        const c = person("c", "Борис Сидоров");
        const d = person("d", "Олег Сидоров");
        const e = person("e", "Ольга Сидорова");
        // 5 carriers but only 2 generations → no clan
        const f1 = family("f1", ["a", "b"], ["c", "d", "e"]);
        expect(computeClans(stemma([a, b, c, d, e], [f1]))).toEqual([]);
    });

    test("six carriers in only two generations → no clan (needs three)", () => {
        const a = person("a", "Иван Сидоров");
        const b = person("b", "Анна Сидорова");
        const c = person("c", "Дочь1 Сидорова");
        const d = person("d", "Сын1 Сидоров");
        const e = person("e", "Сын2 Сидоров");
        const f = person("f", "Сын3 Сидоров");
        const fam = family("f1", ["a", "b"], ["c", "d", "e", "f"]);
        expect(computeClans(stemma([a, b, c, d, e, f], [fam]))).toEqual([]);
    });

    test("dynasty surname persists across in-laws of different surname", () => {
        // Three-generation Romanov chain mixed with non-Romanov spouses
        const m = person("m", "Прадед Романов");
        const w0 = person("w0", "Прабабка Долгорукова");
        const a = person("a", "Дед Романов");
        const w1 = person("w1", "Бабка Стрешнева");
        const p = person("p", "Отец Романов");
        const w2 = person("w2", "Мать Нарышкина");
        const s1 = person("s1", "Сын1 Романов");
        const s2 = person("s2", "Сын2 Романов");
        const s3 = person("s3", "Дочь Романова");
        const f1 = family("f1", ["m", "w0"], ["a"]);
        const f2 = family("f2", ["a", "w1"], ["p"]);
        const f3 = family("f3", ["p", "w2"], ["s1", "s2", "s3"]);
        const clans = computeClans(stemma([m, w0, a, w1, p, w2, s1, s2, s3], [f1, f2, f3]));
        const rom = clans.find(c => c.surname === "Романов")!;
        expect(rom).toBeDefined();
        expect([...rom.personIds].sort()).toEqual(["a", "m", "p", "s1", "s2", "s3"]);
    });

    test("repeating first name across two generations does not form a clan", () => {
        // Мать Мария, дочь Мария, внучка Мария — стоп-токен Мария отсеян даже до спанов.
        const g = person("g", "Бабка Мария Сидорова");
        const m = person("m", "Мать Мария Сидорова");
        const d = person("d", "Дочь Мария Сидорова");
        const f1 = family("f1", ["g"], ["m"]);
        const f2 = family("f2", ["m"], ["d"]);
        const clans = computeClans(stemma([g, m, d], [f1, f2]));
        expect(clans.find(c => c.surname === "Мария")).toBeUndefined();
    });
});
