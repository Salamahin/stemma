import type { CreateNewPerson, FamilyDescription, PersonDescription } from "../model";

export type GhostStubContext = {
    stubId: string;
    anchorPersonId: string;
    anchorRole: "parent" | "child";
};

export type GhostFamilyAction = "addChild" | "addParent";

export type FamilyFromStubPayload = {
    stubId: string;
    anchorPersonId: string;
    anchorRole: "parent" | "child";
    action: GhostFamilyAction;
    newPerson?: CreateNewPerson;
    existingPersonId?: string;
};

export type PersonChoice = CreateNewPerson | PersonDescription;
export type PersonArg = CreateNewPerson | { type: "ExistingPerson"; id: string };

export function canAddParentToFamily(family: FamilyDescription | null | undefined): boolean {
    if (!family) return true;
    return (family.parents?.length ?? 0) < 2;
}

export function toPersonArg(choice: PersonChoice): PersonArg {
    if ("id" in choice) return { type: "ExistingPerson", id: (choice as PersonDescription).id };
    return choice as CreateNewPerson;
}

export function buildStubPayload(
    stub: GhostStubContext,
    action: GhostFamilyAction,
    person: PersonArg,
): FamilyFromStubPayload {
    const payload: FamilyFromStubPayload = {
        stubId: stub.stubId,
        anchorPersonId: stub.anchorPersonId,
        anchorRole: stub.anchorRole,
        action,
    };
    if ("id" in person) payload.existingPersonId = person.id;
    else payload.newPerson = person;
    return payload;
}
