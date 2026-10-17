import type { PersonDescription } from "./model";
import type { StemmaIndex } from "./stemmaIndex";
import { isPendingId } from "./pendingState";

/** What a ghost adds: a spouse/parent/child of a person, or a parent/child of an existing family. */
export type LinkTarget =
    | { kind: "spouse" | "parent" | "child"; personId: string }
    | { kind: "parent" | "child"; familyId: string };

/**
 * Existing people a ghost may link instead of creating someone new — the same
 * rules the backend enforces (only people you may edit, one pair of parents,
 * nobody becomes their own ancestor), so the picker never offers a link that
 * would be rejected.
 */
export function linkCandidates(index: StemmaIndex, people: ReadonlyArray<PersonDescription>, target: LinkTarget): PersonDescription[] {
    const ok = (x: PersonDescription): boolean => {
        if (x.readOnly || isPendingId(x.id)) return false;
        if ("familyId" in target) {
            return (target.kind === "child" ? index.canAddChild(target.familyId, x.id) : index.canAddParent(target.familyId, x.id)).ok;
        }
        const p = target.personId;
        if (x.id === p) return false;
        switch (target.kind) {
            case "spouse":
                // already married to them: that family exists
                return !index.spouseFamilyIds(p).some((fid) => index.family(fid)?.parents.includes(x.id));
            case "parent":
                return !index.isDescendant(p, x.id);
            case "child":
                return !index.hasParentFamily(x.id) && !index.isDescendant(x.id, p);
        }
    };
    return people.filter(ok);
}
