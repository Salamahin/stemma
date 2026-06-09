import type { PersonDefinition, PersonDescription } from "./model";

export type PendingAdd = { tempId: string; name: string };
export type FamilyRole = "parent" | "child";
export type Ref<T> = { get(): T; set(v: T): void };
export type PendingFamily = {
    tempId: string;
    parents: string[];
    children: string[];
    x?: number;
    y?: number;
};

export function isPendingId(id: string): boolean {
    return id.startsWith("pending-");
}

export function isPendingFamilyId(id: string): boolean {
    return id.startsWith("pending-family-");
}

export function isPendingPersonId(id: string): boolean {
    return isPendingId(id) && !isPendingFamilyId(id);
}

export function newPendingPersonId(): string {
    return `pending-${crypto.randomUUID()}`;
}

export function newPendingFamilyId(): string {
    return `pending-family-${crypto.randomUUID()}`;
}

export function pendingPersonDescription(p: PendingAdd): PersonDescription {
    return {
        type: "PersonDescription",
        id: p.tempId,
        name: p.name,
        birthDate: null,
        deathDate: null,
        bio: null,
        readOnly: true,
        photoUrl: null,
    };
}

export function composeFamilyMembers(
    parentIds: string[],
    childIds: string[],
    incoming: PersonDefinition,
    role: FamilyRole,
): { parents: PersonDefinition[]; children: PersonDefinition[] } {
    const parentDefs: PersonDefinition[] = parentIds.map((id) => ({ type: "ExistingPerson", id }));
    const childDefs: PersonDefinition[] = childIds.map((id) => ({ type: "ExistingPerson", id }));
    return {
        parents: role === "parent" ? [...parentDefs, incoming] : parentDefs,
        children: role === "child" ? [...childDefs, incoming] : childDefs,
    };
}

export function familyHasPerson(family: { parents: string[]; children: string[] }, pid: string): boolean {
    return family.parents.includes(pid) || family.children.includes(pid);
}
