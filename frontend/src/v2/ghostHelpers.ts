import type { FamilyDescription } from "../model";

export type GhostFamilyAction = "addChild" | "addParent";

export function canAddParentToFamily(family: FamilyDescription | null | undefined): boolean {
    if (!family) return true;
    return (family.parents?.length ?? 0) < 2;
}
