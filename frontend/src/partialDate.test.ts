import { formatPartialDate, isBefore, parseDateInput, toDateInput } from "./partialDate";

describe("parseDateInput", () => {
    test.each([
        ["1899", "1899"],
        ["03.1899", "1899-03"],
        ["3.1899", "1899-03"],
        ["16.03.1899", "1899-03-16"],
        ["6.3.1899", "1899-03-06"],
        ["~1820", "~1820"],
        ["ок. 1820", "~1820"],
        ["около 03.1820", "~1820-03"],
        ["c. 1820", "~1820"],
        ["ca 1820", "~1820"],
        ["1899-03", "1899-03"],
        ["  16.03.1899 ", "1899-03-16"],
    ])("%p → %p", (input, expected) => {
        expect(parseDateInput(input)).toEqual({ ok: true, value: expected });
    });

    test("an empty field means no date", () => {
        expect(parseDateInput("")).toEqual({ ok: true, value: null });
        expect(parseDateInput("   ")).toEqual({ ok: true, value: null });
    });

    test.each(["13.1899", "30.02.1899", "18990", "abc", "16.03", "~", "1.2.3.1899"])("rejects %p", (input) => {
        expect(parseDateInput(input).ok).toBe(false);
    });

    test("rejects dates in the future", () => {
        expect(parseDateInput("3000").ok).toBe(false);
    });
});

describe("toDateInput", () => {
    test("round-trips through the input format", () => {
        for (const iso of ["1899", "1899-03", "1899-03-16", "~1820", "~1820-03-01"]) {
            const r = parseDateInput(toDateInput(iso));
            expect(r).toEqual({ ok: true, value: iso });
        }
        expect(toDateInput(null)).toBe("");
    });
});

describe("formatPartialDate", () => {
    test("shows only the known precision", () => {
        expect(formatPartialDate("1899", "en")).toBe("1899");
        expect(formatPartialDate("1899-03", "en")).toBe("Mar 1899");
        expect(formatPartialDate("1899-03-16", "en")).toBe("16 Mar 1899");
        expect(formatPartialDate("1899-03-16", "ru")).toBe("16 мар. 1899");
        expect(formatPartialDate("1899-03", "ru")).toBe("март 1899");
    });

    test("marks approximate dates", () => {
        expect(formatPartialDate("~1820", "en")).toBe("c. 1820");
        expect(formatPartialDate("~1820", "ru")).toBe("ок. 1820");
    });

    test("tolerates missing or broken values", () => {
        expect(formatPartialDate(null, "en")).toBe("");
        expect(formatPartialDate("garbage", "en")).toBe("garbage");
    });
});

describe("isBefore", () => {
    test("compares only what both dates know", () => {
        expect(isBefore("1899", "1900")).toBe(true);
        expect(isBefore("1899-03-16", "1899")).toBe(false);
        expect(isBefore("1899-05", "1899-03-16")).toBe(false);
        expect(isBefore("1899-03-01", "1899-03-16")).toBe(true);
        expect(isBefore("~1900", "1899")).toBe(false);
    });
});
