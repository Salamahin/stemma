import type { FocusedId } from "./focusGesture";
import type { StemmaIndex } from "../stemmaIndex";
import type { FamilyRole } from "./pendingState";

export type GhostKind = "spouse" | "parent" | "child";

/** Sentinel familyId meaning "attach to the focused real family". */
export const FOCUSED_FAMILY_REF = "__focused-family__";

export type GhostFamilyPlan = {
    id: string;
    dx: number;
    dy: number;
};

export type GhostPersonPlan = {
    id: string;
    kind: GhostKind;
    labelKey: string;
    /** Family this person attaches to. Either a ghost family id or FOCUSED_FAMILY_REF. */
    familyId: string;
    /** "parent" — person is incoming parent of family. "child" — person is outgoing child of family. */
    role: FamilyRole;
    dx: number;
    dy: number;
};

export type GhostAnchorEdge = {
    familyId: string;
    /** Relation of the focused node to the ghost family (focused acts as parent or child). */
    focusedRole: FamilyRole;
};

export type GhostLayout = {
    families: GhostFamilyPlan[];
    persons: GhostPersonPlan[];
    anchorEdges: GhostAnchorEdge[];
};

const LABEL_KEYS: Record<GhostKind, string> = {
    spouse: "v3.addAnotherSpouse",
    parent: "v3.addParent",
    child: "v3.addChild",
};

export function deriveGhostLayout(
    focusedId: FocusedId | null,
    stemmaIndex: StemmaIndex,
): GhostLayout {
    if (!focusedId) return { families: [], persons: [], anchorEdges: [] };

    if (focusedId.kind === "person") {
        const families: GhostFamilyPlan[] = [];
        const persons: GhostPersonPlan[] = [];
        const anchorEdges: GhostAnchorEdge[] = [];

        // One shared ghost family east of focused. Both spouse-ghost and
        // child-ghost attach to it: clicking spouse adds a second parent,
        // clicking child adds a child to that same future family.
        const shared: GhostFamilyPlan = { id: "ghost-family-east", dx: 100, dy: 0 };
        families.push(shared);
        anchorEdges.push({ familyId: shared.id, focusedRole: "parent" });
        persons.push({
            id: "ghost-person-spouse",
            kind: "spouse",
            labelKey: LABEL_KEYS.spouse,
            familyId: shared.id,
            role: "parent",
            dx: 200,
            dy: 0,
        });
        persons.push({
            id: "ghost-person-child",
            kind: "child",
            labelKey: LABEL_KEYS.child,
            familyId: shared.id,
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

export type NeighborRef = { kind: "person" | "family"; id: string };

/**
 * 1-hop neighbors of the focused entity. Used to leave these unfrozen during
 * ghost physics so they can be pushed aside; the focused node itself is frozen
 * separately.
 */
export function immediateNeighborIds(focusedId: FocusedId, stemmaIndex: StemmaIndex): readonly NeighborRef[] {
    const seen = new Set<string>();
    const refs: NeighborRef[] = [];

    const addPerson = (id: string) => {
        if (!seen.has(id) && id !== focusedId.id) {
            seen.add(id);
            refs.push({ kind: "person", id });
        }
    };
    const addFamily = (id: string) => {
        if (!seen.has(id) && id !== focusedId.id) {
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
