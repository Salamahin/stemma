/**
 * Pure helpers for the v3 ghost-node affordances.
 *
 * Ghosts are dashed placeholder nodes rendered around the focused entity to
 * invite the user to add a spouse, parent, or child without needing drag
 * gestures.  All logic here is pure so it can be unit-tested without a DOM.
 */

import type { FocusedId } from "./focusGesture";
import type { StemmaIndex } from "../stemmaIndex";

export type GhostKind = "spouse" | "parent" | "child";

/** Legacy action type used by V3FamilyGhost popover component. */
export type GhostFamilyAction = "addChild" | "addParent";

export type GhostDescriptor = {
    /** Stable DOM id assigned to the ghost <g> element. */
    id: string;
    kind: GhostKind;
    /** i18n key for the ghost label. */
    labelKey: string;
    /** Offset from the focused node's (x, y) in SVG user-space. */
    dx: number;
    dy: number;
};

/**
 * A ghost branch consists of an intermediate ghost family node and an endpoint
 * ghost person node, both positioned relative to the focused real node.
 *
 * When the focused entity is a family, there is no intermediate ghost family —
 * only a ghost person (child).  In that case `familyId` is null.
 *
 * For a child branch attached to an existing spouse-family: `familyId` is null
 * and `existingFamilyId` is the real family id.  The ghost-person becomes a
 * sibling inside that existing family via link forces.
 */
export type GhostBranch = {
    kind: GhostKind;
    /** Stable DOM ids for the ghost family <g> and ghost person <g>. */
    familyId: string | null;
    personId: string;
    /** i18n key for the ghost person label. */
    labelKey: string;
    /**
     * Seed offsets (SVG user-space) from the focused node's center.
     * family* offsets are the intermediate node; person* offsets are the endpoint.
     */
    familyDx: number;
    familyDy: number;
    personDx: number;
    personDy: number;
    /**
     * When set, the ghost child belongs to this existing real family rather than
     * a new ghost family.  The sim links the real family node to the ghost-person
     * so existing siblings shift via collision + link forces.
     */
    existingFamilyId?: string;
};

const GHOST_OFFSETS: Record<GhostKind, { dx: number; dy: number }> = {
    spouse: { dx: 100, dy: 0 },
    parent: { dx: 0, dy: -100 },
    child: { dx: 0, dy: 100 },
};

const GHOST_LABEL_KEYS: Record<GhostKind, string> = {
    spouse: "v3.addAnotherSpouse",
    parent: "v3.addParent",
    child: "v3.addChild",
};

/**
 * Derives the list of ghost descriptors for the currently focused entity.
 *
 * Rules (per CLAUDE.md):
 * - Focused person → spouse-ghost (always) + parent-ghost (only if person
 *   has no parent family).
 * - Focused family → child-ghost (always).
 * - No focus → empty list.
 *
 * @deprecated Use deriveGhostBranches for the new branch-based rendering.
 */
export function deriveGhosts(
    focusedId: FocusedId | null,
    stemmaIndex: StemmaIndex,
): readonly GhostDescriptor[] {
    if (!focusedId) return [];

    if (focusedId.kind === "person") {
        const ghosts: GhostDescriptor[] = [ghostDescriptor("spouse")];
        if (!stemmaIndex.hasParentFamily(focusedId.id)) {
            ghosts.push(ghostDescriptor("parent"));
        }
        return ghosts;
    }

    if (focusedId.kind === "family") {
        return [ghostDescriptor("child")];
    }

    return [];
}

function ghostDescriptor(kind: GhostKind): GhostDescriptor {
    const { dx, dy } = GHOST_OFFSETS[kind];
    return {
        id: `ghost-${kind}`,
        kind,
        labelKey: GHOST_LABEL_KEYS[kind],
        dx,
        dy,
    };
}

export type NeighborRef = { kind: "person" | "family"; id: string };

/**
 * Returns the immediate (1-hop) neighbors of the focused entity in the family
 * graph as tagged refs.  These nodes are unfrozen during ghost physics so the
 * ghost branch can push them aside if needed.
 *
 * For a focused person P:
 *   every family F that contains P  +  every person Q that shares a family with P.
 * For a focused family F:
 *   every person in F's parents and children.
 * The focused node itself is NOT included (it is frozen separately).
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
        const families = stemmaIndex.relatedFamilies(focusedId.id);
        for (const f of families) {
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

/**
 * Derives ghost branches for the currently focused entity.
 *
 * Each branch for a focused person contains an intermediate ghost family node
 * and an endpoint ghost person node.  For a focused family the branch has no
 * intermediate ghost family (the family already exists) — only a ghost person.
 *
 * Child-branch rules for a focused person:
 * - If the person is a parent in one or more spouse-families: emit one child
 *   branch per spouse-family with `existingFamilyId` set (no ghost family).
 * - If the person has no spouse-families: emit one child branch with a new
 *   ghost family (legacy behavior).
 *
 * Seed offsets (SVG user-space, relative to focused node center):
 * - spouse:  ghost family at (+80, 0), ghost person at (+160, 0)
 * - parent:  ghost family at (0, -80), ghost person at (0, -160)
 * - child (existing family): ghost person at (0, +100) — linked to real family
 * - child (new ghost family): ghost family at (0, +80), ghost person at (0, +160)
 * - child (family-focused): ghost person at (0, +100) — no ghost family
 */
export function deriveGhostBranches(
    focusedId: FocusedId | null,
    stemmaIndex: StemmaIndex,
): readonly GhostBranch[] {
    if (!focusedId) return [];

    if (focusedId.kind === "person") {
        const branches: GhostBranch[] = [
            {
                kind: "spouse",
                familyId: "ghost-family-spouse",
                personId: "ghost-person-spouse",
                labelKey: GHOST_LABEL_KEYS["spouse"],
                familyDx: 80,
                familyDy: 0,
                personDx: 160,
                personDy: 0,
            },
        ];
        if (!stemmaIndex.hasParentFamily(focusedId.id)) {
            branches.push({
                kind: "parent",
                familyId: "ghost-family-parent",
                personId: "ghost-person-parent",
                labelKey: GHOST_LABEL_KEYS["parent"],
                familyDx: 0,
                familyDy: -80,
                personDx: 0,
                personDy: -160,
            });
        }

        const spouseFamilies = stemmaIndex.spouseFamilyIds(focusedId.id);
        if (spouseFamilies.length > 0) {
            spouseFamilies.forEach((familyId, i) => {
                branches.push({
                    kind: "child",
                    familyId: null,
                    personId: `ghost-person-child-${i}`,
                    labelKey: GHOST_LABEL_KEYS["child"],
                    familyDx: 0,
                    familyDy: 0,
                    personDx: 0,
                    personDy: 100,
                    existingFamilyId: familyId,
                });
            });
        } else {
            branches.push({
                kind: "child",
                familyId: "ghost-family-child",
                personId: "ghost-person-child",
                labelKey: GHOST_LABEL_KEYS["child"],
                familyDx: 0,
                familyDy: 80,
                personDx: 0,
                personDy: 160,
            });
        }
        return branches;
    }

    if (focusedId.kind === "family") {
        return [
            {
                kind: "child",
                familyId: null,
                personId: "ghost-person-child",
                labelKey: GHOST_LABEL_KEYS["child"],
                familyDx: 0,
                familyDy: 0,
                personDx: GHOST_OFFSETS["child"].dx,
                personDy: GHOST_OFFSETS["child"].dy,
            },
        ];
    }

    return [];
}
