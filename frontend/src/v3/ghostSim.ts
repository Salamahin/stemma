import { normalizeId } from "../graphTools";
import type { StemmaIndex } from "../stemmaIndex";
import type { FocusedId } from "./focusGesture";
import {
    FOCUSED_FAMILY_REF,
    immediateNeighborIds,
    realFamilyIdFromRef,
    type GhostKind,
    type GhostLayout,
} from "./ghostHelpers";

/**
 * Collide-radius hints stored on the datums while a focus is active. The
 * main sim's collide force is `radius((d) => d.r * 20)` and real datums
 * carry no `r` by default, so unless we set one the collide pair (ghost,
 * real) only counts the ghost side. Ghost r=4 (80 px) + neighbour r=1.5
 * (30 px) ⇒ 110 px minimum separation — plenty for the rendered circle
 * sizes plus padding.
 */
export const GHOST_NODE_COLLIDE_R = 4;
export const GHOST_NEIGHBOUR_COLLIDE_R = 1.5;

export type GhostEdgeKind = "focusToFamily" | "familyToPerson";

export type GhostExtraNode = {
    id: string;
    type: "ghost-person" | "ghost-family";
    /** Present for ghost-person nodes the user can click. */
    kind?: GhostKind;
    labelKey?: string;
    /** dom-id of the family node the click should attach the new person to. */
    anchorSimId?: string;
    /** Real family id when this ghost extends an existing spouse-family. */
    existingFamilyId?: string;
    x: number;
    y: number;
    r: number;
};

export type GhostExtraLink = {
    id: string;
    source: string;
    target: string;
    edgeKind: GhostEdgeKind;
};

export type GhostInjection = {
    focusedDomId: string;
    extraNodes: GhostExtraNode[];
    extraLinks: GhostExtraLink[];
};

export type GhostAnchors = {
    origin: { x: number; y: number };
    /** familyId (ghost id, FOCUSED_FAMILY_REF, or existing:<realId>) → svg position. */
    familyAnchorByRef: Map<string, { x: number; y: number }>;
    /** ghost-person id → svg position. */
    personPositionById: Map<string, { x: number; y: number }>;
};

export function resolveAnchorSimId(focusedDomId: string, familyRef: string): string {
    if (familyRef === FOCUSED_FAMILY_REF) return focusedDomId;
    const real = realFamilyIdFromRef(familyRef);
    return real ? normalizeId("family", real) : familyRef;
}

/**
 * Build the extra nodes + links to inject into the main d3 simulation so
 * that ghost circles participate in the same forces (link, charge, collide)
 * as real nodes. The caller is responsible for unfreezing the 1-hop real
 * neighbours and adding the extras to `simulation.nodes()` /
 * `simulation.force("link").links()`.
 */
export function buildGhostInjection(
    focusedId: FocusedId,
    layout: GhostLayout,
    anchors: GhostAnchors,
): GhostInjection {
    const focusedDomId = normalizeId(focusedId.kind, focusedId.id);
    const extraNodes: GhostExtraNode[] = [];
    const extraLinks: GhostExtraLink[] = [];

    for (const f of layout.families) {
        const pos = anchors.familyAnchorByRef.get(f.id);
        if (!pos) continue;
        extraNodes.push({
            id: f.id,
            type: "ghost-family",
            x: pos.x,
            y: pos.y,
            r: GHOST_NODE_COLLIDE_R,
        });
    }

    for (const p of layout.persons) {
        const pos = anchors.personPositionById.get(p.id);
        if (!pos) continue;
        const existingFamilyId = realFamilyIdFromRef(p.familyId) ?? undefined;
        extraNodes.push({
            id: p.id,
            type: "ghost-person",
            kind: p.kind,
            labelKey: p.labelKey,
            anchorSimId: resolveAnchorSimId(focusedDomId, p.familyId),
            existingFamilyId,
            x: pos.x,
            y: pos.y,
            r: GHOST_NODE_COLLIDE_R,
        });
    }

    for (const a of layout.anchorEdges) {
        if (!anchors.familyAnchorByRef.has(a.familyId)) continue;
        if (a.focusedRole === "parent") {
            extraLinks.push({
                id: `gl-${focusedDomId}-${a.familyId}`,
                source: focusedDomId,
                target: a.familyId,
                edgeKind: "focusToFamily",
            });
        } else {
            extraLinks.push({
                id: `gl-${a.familyId}-${focusedDomId}`,
                source: a.familyId,
                target: focusedDomId,
                edgeKind: "familyToPerson",
            });
        }
    }

    for (const p of layout.persons) {
        if (!anchors.personPositionById.has(p.id)) continue;
        const anchorSimId = resolveAnchorSimId(focusedDomId, p.familyId);
        if (p.role === "parent") {
            extraLinks.push({
                id: `gl-${p.id}-${anchorSimId}`,
                source: p.id,
                target: anchorSimId,
                edgeKind: "focusToFamily",
            });
        } else {
            extraLinks.push({
                id: `gl-${anchorSimId}-${p.id}`,
                source: anchorSimId,
                target: p.id,
                edgeKind: "familyToPerson",
            });
        }
    }

    return { focusedDomId, extraNodes, extraLinks };
}

/** Convenience: dom-ids of the 1-hop real neighbours that should be unfrozen while focused. */
export function ghostSimNeighborDomIds(
    focusedId: FocusedId,
    stemmaIndex: StemmaIndex,
): Set<string> {
    const out = new Set<string>();
    for (const ref of immediateNeighborIds(focusedId, stemmaIndex)) {
        out.add(normalizeId(ref.kind, ref.id));
    }
    return out;
}
