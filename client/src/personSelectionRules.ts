import type { CreateNewPerson, PersonDescription } from "./model";

export type SelectablePerson = CreateNewPerson | PersonDescription;

export function filterEditablePeople(people: SelectablePerson[]) {
    return people.filter((p) => !("readOnly" in p) || !p.readOnly);
}
