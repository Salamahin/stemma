import type { StemmaIndex } from "./stemmaIndex";
import { isPendingId } from "./pendingState";

/** A link between two people already in the tree (link mode: drag one onto the other). */
export type LinkOption =
    | { kind: "spouses"; a: string; b: string }
    /** `childId` becomes a child of `parentId`: in their family `familyId`, or (null) a new one with them alone. */
    | { kind: "child"; childId: string; parentId: string; familyId: string | null };

/**
 * Every valid way to link `a` and `b`: as spouses (a new family), or one as
 * the child of the other — in each of the parent's own families that can take
 * them, or in a new family with that parent alone. Same rules as the backend,
 * so nothing offered is rejected.
 */
export function linkOptions(index: StemmaIndex, a: string, b: string): LinkOption[] {
    if (a === b) return [];
    const pa = index.person(a);
    const pb = index.person(b);
    if (!pa || !pb || pa.readOnly || pb.readOnly || isPendingId(a) || isPendingId(b)) return [];
    const out: LinkOption[] = [];
    const married = index.spouseFamilyIds(a).some((fid) => index.family(fid)?.parents.includes(b));
    if (!married) out.push({ kind: "spouses", a, b });
    const childOf = (child: string, parent: string) => {
        if (index.hasParentFamily(child) || index.isDescendant(child, parent)) return;
        const families = index.spouseFamilyIds(parent);
        for (const fid of families) {
            if (index.canAddChild(fid, child).ok) out.push({ kind: "child", childId: child, parentId: parent, familyId: fid });
        }
        // a family of the parent alone is reused above; otherwise a new one
        const alone = families.some((fid) => {
            const parents = index.family(fid)?.parents ?? [];
            return parents.length === 1 && parents[0] === parent;
        });
        if (!alone) out.push({ kind: "child", childId: child, parentId: parent, familyId: null });
    };
    childOf(b, a);
    childOf(a, b);
    return out;
}
