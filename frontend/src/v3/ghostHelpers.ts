import type { FocusedId } from "./focusGesture";
import type { StemmaIndex } from "../stemmaIndex";
import { isPendingId, type FamilyRole } from "./pendingState";

export type GhostKind = "spouse" | "parent" | "child";

/** Sentinel familyId: attach to the focused real family. */
export const FOCUSED_FAMILY_REF = "__focused-family__";

/** Prefix that marks a ghost-person plan's familyId as an existing real family id. */
export const EXISTING_FAMILY_PREFIX = "existing:";

export type GhostFamilyPlan = {
    id: string;
    /** Offset from focused-node center, in SVG user-space. */
    dx: number;
    dy: number;
};

export type GhostPersonPlan = {
    id: string;
    kind: GhostKind;
    labelKey: string;
    /**
     * Family this person attaches to. One of:
     * - a ghost family id declared in `families`
     * - FOCUSED_FAMILY_REF (focused-family case)
     * - `${EXISTING_FAMILY_PREFIX}<realFamilyId>` (extra child slot in an existing spouse-family)
     */
    familyId: string;
    /** Person is incoming parent (arrow person→family) or outgoing child (family→person). */
    role: FamilyRole;
    /** Offset relative to the family anchor center if familyId points to a real family, else to focused. */
    dx: number;
    dy: number;
};

export type GhostAnchorEdge = {
    familyId: string;
    /** Focused acts as parent (focused→family) or child (family→focused) of this ghost family. */
    focusedRole: FamilyRole;
};

export type GhostLayout = {
    families: GhostFamilyPlan[];
    persons: GhostPersonPlan[];
    anchorEdges: GhostAnchorEdge[];
};

const LABEL_KEYS: Record<GhostKind, string> = {
    spouse: "v3.addSpouse",
    parent: "v3.addParent",
    child: "v3.addChild",
};

export function existingFamilyRef(realFamilyId: string): string {
    return `${EXISTING_FAMILY_PREFIX}${realFamilyId}`;
}

export function realFamilyIdFromRef(familyRef: string): string | null {
    if (!familyRef.startsWith(EXISTING_FAMILY_PREFIX)) return null;
    return familyRef.slice(EXISTING_FAMILY_PREFIX.length);
}

export type NeighborRef = { kind: "person" | "family"; id: string };

/**
 * 1-hop neighbors of the focused entity. The ghost-layer sim leaves these
 * unfrozen so ghost circles can push them aside via collision force. The
 * focused node itself is excluded — it is frozen separately. Pending
 * entities are also excluded: they were just placed by the user at the
 * release point of a drag and must stay there so the follow-up gesture
 * can target them.
 */
export function immediateNeighborIds(
    focusedId: FocusedId,
    stemmaIndex: StemmaIndex,
): readonly NeighborRef[] {
    const seen = new Set<string>();
    const refs: NeighborRef[] = [];

    const addPerson = (id: string) => {
        if (!seen.has(id) && id !== focusedId.id && !isPendingId(id)) {
            seen.add(id);
            refs.push({ kind: "person", id });
        }
    };
    const addFamily = (id: string) => {
        if (!seen.has(id) && id !== focusedId.id && !isPendingId(id)) {
            seen.add(id);
            refs.push({ kind: "family", id });
        }
    };

    if (focusedId.kind === "person") {
        for (const f of stemmaIndex.relatedFamilies(focusedId.id)) {
            addFamily(f.id);
            for (const pid of f.parents) addPerson(pid);
            for (const pid of f.children) addPerson(pid);
        }
        return refs;
    }

    if (focusedId.kind === "family") {
        const f = stemmaIndex.family(focusedId.id);
        if (f) {
            for (const pid of f.parents) addPerson(pid);
            for (const pid of f.children) addPerson(pid);
        }
        return refs;
    }

    return refs;
}

export function deriveGhostLayout(
    focusedId: FocusedId | null,
    stemmaIndex: StemmaIndex,
): GhostLayout {
    if (!focusedId) return { families: [], persons: [], anchorEdges: [] };

    if (focusedId.kind === "person") {
        const families: GhostFamilyPlan[] = [];
        const persons: GhostPersonPlan[] = [];
        const anchorEdges: GhostAnchorEdge[] = [];

        // Shared east-side ghost family hosts both "add another spouse" and
        // "add child". Click on the child slot creates a new family with the
        // focused person as the sole parent; users wanting to extend an
        // existing spouse-family use the drag gesture or the family card.
        const eastFamily: GhostFamilyPlan = { id: "ghost-family-east", dx: 100, dy: 0 };
        families.push(eastFamily);
        anchorEdges.push({ familyId: eastFamily.id, focusedRole: "parent" });
        persons.push({
            id: "ghost-person-spouse",
            kind: "spouse",
            labelKey: LABEL_KEYS.spouse,
            familyId: eastFamily.id,
            role: "parent",
            dx: 200,
            dy: 0,
        });
        persons.push({
            id: "ghost-person-child",
            kind: "child",
            labelKey: LABEL_KEYS.child,
            familyId: eastFamily.id,
            role: "child",
            dx: 100,
            dy: 100,
        });

        if (!stemmaIndex.hasParentFamily(focusedId.id)) {
            const parentFamily: GhostFamilyPlan = { id: "ghost-family-parent", dx: 0, dy: -100 };
            families.push(parentFamily);
            anchorEdges.push({ familyId: parentFamily.id, focusedRole: "child" });
            persons.push({
                id: "ghost-person-parent",
                kind: "parent",
                labelKey: LABEL_KEYS.parent,
                familyId: parentFamily.id,
                role: "parent",
                dx: 0,
                dy: -200,
            });
        }

        return { families, persons, anchorEdges };
    }

    if (focusedId.kind === "family") {
        return {
            families: [],
            persons: [
                {
                    id: "ghost-person-child",
                    kind: "child",
                    labelKey: LABEL_KEYS.child,
                    familyId: FOCUSED_FAMILY_REF,
                    role: "child",
                    dx: 0,
                    dy: 100,
                },
            ],
            anchorEdges: [],
        };
    }

    return { families: [], persons: [], anchorEdges: [] };
}
