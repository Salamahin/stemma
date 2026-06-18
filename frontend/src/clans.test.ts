import { clanColor, computeClans, extractSurname, pluralizeSurname } from "./clans";
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

describe("extractSurname", () => {
    test.each([
        ["Иван Иванов", "Иванов"],
        ["John Smith", "Smith"],
        ["  Anna   van der Berg  ", "Berg"],
        ["Madonna", "Madonna"],
        ["", ""],
        [null, ""],
        [undefined, ""],
    ])("%j → %j", (input, expected) => {
        expect(extractSurname(input as any)).toBe(expected);
    });
});

describe("pluralizeSurname (ru)", () => {
    test.each([
        ["Иванов", "Ивановы"],
        ["Иванова", "Ивановы"],
        ["Медведев", "Медведевы"],
        ["Медведева", "Медведевы"],
        ["Пушкин", "Пушкины"],
        ["Пушкина", "Пушкины"],
        ["Достоевский", "Достоевские"],
        ["Достоевская", "Достоевские"],
        ["Троцкий", "Троцкие"],
        ["Сидоровы", "Сидоровы"],
        ["Ивановы", "Ивановы"],
        ["Достоевские", "Достоевские"],
        ["Гёте", "Гётеы"],
    ])("ru: %s → %s", (s, expected) => {
        expect(pluralizeSurname(s, "ru")).toBe(expected);
    });
});

describe("pluralizeSurname (en)", () => {
    test("appends s", () => {
        expect(pluralizeSurname("Smith", "en")).toBe("Smiths");
    });
    test("empty stays empty", () => {
        expect(pluralizeSurname("", "en")).toBe("");
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

describe("computeClans", () => {
    test("two connected components, dominant surname per each", () => {
        // Сидоровы family + Петровы family, plus a lonely Иванов
        const sidA = person("s1", "Анна Сидорова");
        const sidB = person("s2", "Борис Сидоров");
        const sidC = person("s3", "Вера Сидорова");
        const petX = person("p1", "Олег Петров");
        const petY = person("p2", "Ольга Петрова");
        const lonely = person("l1", "Лев Иванов");

        const sidFam = family("f1", ["s1", "s2"], ["s3"]);
        const petFam = family("f2", ["p1", "p2"], []);

        const clans = computeClans(stemma([sidA, sidB, sidC, petX, petY, lonely], [sidFam, petFam]), "ru");

        const surnames = clans.map(c => c.surname).sort();
        expect(surnames).toEqual(["Петров", "Сидоров"]);
        const sid = clans.find(c => c.surname === "Сидоров")!;
        expect(sid.plural).toBe("Сидоровы");
        expect([...sid.personIds].sort()).toEqual(["s1", "s2", "s3"]);
        const pet = clans.find(c => c.surname === "Петров")!;
        expect(pet.plural).toBe("Петровы");
    });

    test("single-person component is not a clan", () => {
        const a = person("a", "Anna Smith");
        const clans = computeClans(stemma([a], []), "en");
        expect(clans).toEqual([]);
    });

    test("component without majority surname (everyone different) → no clan", () => {
        const a = person("a", "Anna Smith");
        const b = person("b", "Bob Jones");
        const f = family("f1", ["a", "b"], []);
        const clans = computeClans(stemma([a, b], [f]), "en");
        expect(clans).toEqual([]);
    });

    test("merged-by-marriage component: only persons sharing the dominant surname are in the clan", () => {
        const sidA = person("a", "Анна Сидорова");
        const sidB = person("b", "Борис Сидоров");
        const sidC = person("c", "Вера Сидорова");
        const petX = person("d", "Олег Петров");
        // petX marries sidC → families connect petX into the Сидоров component
        const sidFam = family("f1", ["a", "b"], ["c"]);
        const marriage = family("f2", ["c", "d"], []);
        const clans = computeClans(stemma([sidA, sidB, sidC, petX], [sidFam, marriage]), "ru");

        expect(clans).toHaveLength(1);
        expect(clans[0].surname).toBe("Сидоров");
        expect([...clans[0].personIds].sort()).toEqual(["a", "b", "c"]);
        expect(clans[0].personIds.has("d")).toBe(false);
    });

    test("two clans within one component when a marriage joins two surname groups", () => {
        // Романовы (3) + Долгоруковы (2) in one component via marriage
        const r1 = person("r1", "Михаил Романов");
        const r2 = person("r2", "Алексей Романов");
        const r3 = person("r3", "Пётр Романов");
        const d1 = person("d1", "Мария Долгорукова");
        const d2 = person("d2", "Иван Долгоруков");
        const fParent = family("f1", ["d2"], ["d1"]); // Иван → Мария
        const fMarriage = family("f2", ["r1", "d1"], ["r2", "r3"]); // Михаил + Мария
        const clans = computeClans(stemma([r1, r2, r3, d1, d2], [fParent, fMarriage]), "ru");
        expect(clans.map(c => c.surname).sort()).toEqual(["Долгоруков", "Романов"]);
        const rom = clans.find(c => c.surname === "Романов")!;
        const dolg = clans.find(c => c.surname === "Долгоруков")!;
        expect([...rom.personIds].sort()).toEqual(["r1", "r2", "r3"]);
        expect([...dolg.personIds].sort()).toEqual(["d1", "d2"]);
    });

    test("persons without a surname are ignored when counting dominant", () => {
        const a = person("a", "");
        const b = person("b", "   ");
        const c = person("c", "Иван Иванов");
        const d = person("d", "Пётр Иванов");
        const f = family("f1", ["a", "b"], ["c", "d"]);
        const clans = computeClans(stemma([a, b, c, d], [f]), "ru");
        expect(clans).toHaveLength(1);
        expect(clans[0].surname).toBe("Иванов");
        expect([...clans[0].personIds].sort()).toEqual(["c", "d"]);
    });
});
