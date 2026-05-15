import { filterEditablePeople, type SelectablePerson } from "./personSelectionRules";

describe("filterEditablePeople", () => {
    test("keeps creatable person entries and editable people", () => {
        const alice: SelectablePerson = { type: "PersonDescription", id: "1", name: "Alice", readOnly: false };
        const bob: SelectablePerson = { type: "PersonDescription", id: "2", name: "Bob", readOnly: true };
        const newPerson: SelectablePerson = { type: "CreateNewPerson", name: "New Person" };

        expect(filterEditablePeople([alice, bob, newPerson])).toEqual([alice, newPerson]);
    });

    test("handles empty input", () => {
        expect(filterEditablePeople([])).toEqual([]);
    });
});
