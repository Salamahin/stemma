import { filterEditablePeople } from "./personSelectionRules";

describe("filterEditablePeople", () => {
    test("keeps creatable person entries and editable people", () => {
        const input = [
            { id: "1", name: "Alice", readOnly: false },
            { id: "2", name: "Bob", readOnly: true },
            { name: "New Person" },
        ];

        expect(filterEditablePeople(input)).toEqual([
            { id: "1", name: "Alice", readOnly: false },
            { name: "New Person" },
        ]);
    });

    test("handles empty input", () => {
        expect(filterEditablePeople([])).toEqual([]);
    });
});
