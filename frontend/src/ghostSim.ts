import { normalizeId } from "./graphTools";
import type { StemmaIndex } from "./stemmaIndex";
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

/** Real nodes within this distance of a ghost's seed position make room for it (the ghosts drift a little during the burst). */
export const GHOST_PUSH_REACH = 220;
/** Distance a pushed real node keeps from a ghost centre (ghost circle + label + padding). */
export const GHOST_PUSH_CLEARANCE = 110;
/** Share of the remaining overlap resolved per tick, and pull back towards the original spot. */
const PUSH_STEP = 0.35;
const PUSH_SPRING = 0.04;
/** Closest two people may be pushed together (they never end up closer than they were). */
const NODE_SEPARATION = 45;
/** Separation passes per step (a push can shove a short chain of people). */
const SEPARATION_PASSES = 3;

type Movable = { x: number; y: number };
type FrozenCopy = { x: number; y: number; fx?: number | null; fy?: number | null };

/**
 * Makes room for the ghosts around a focused node: real nodes near the ghosts
 * are nudged away from the ghosts while the burst runs and put back on blur.
 * They are not unfrozen in the burst simulation itself: edit mode keeps the
 * graph pinned wherever it was left (rarely an equilibrium), so the full
 * forces would make neighbours drift even with no ghost near them. Instead
 * each pushed node feels only the ghosts (collision-like) and a spring to its
 * original spot; its frozen copy follows, so the ghosts collide with it where
 * it now is. The focused node stays under the pointer.
 */
export class NeighbourPush<T extends Movable & { id: string }> {
    /** `lx`/`ly`: where the last step left the node (NaN before the first step). */
    private items: Array<{ node: Movable; copy: FrozenCopy | undefined; ox: number; oy: number; lx: number; ly: number }> = [];
    /**
     * Pairs (pushed node, any node nearby) and how close they may get: no
     * closer than they were, up to `NODE_SEPARATION` — so a push never piles
     * people onto each other or onto the nodes that stay put.
     */
    private pairs: Array<{ a: number; b: Movable; bIndex: number; min: number }> = [];

    /** Ids of the nodes that may be pushed. */
    readonly pushedIds = new Set<string>();

    constructor(
        nodes: ReadonlyArray<T>,
        copies: Map<string, FrozenCopy>,
        focusedDomId: string,
        ghosts: ReadonlyArray<{ x: number; y: number }>,
        skip: (n: T) => boolean = () => false,
    ) {
        const toGhost = (n: Movable) => {
            let best = Infinity;
            for (const g of ghosts) best = Math.min(best, Math.hypot(n.x - g.x, n.y - g.y));
            return best;
        };
        // everyone a pushed node could end up next to
        const aroundReach = GHOST_PUSH_REACH + GHOST_PUSH_CLEARANCE + NODE_SEPARATION;
        const around: Array<{ node: Movable; item: number }> = [];
        for (const n of nodes) {
            const dist = toGhost(n);
            if (dist > aroundReach) continue;
            let item = -1;
            if (n.id !== focusedDomId && !skip(n) && dist <= GHOST_PUSH_REACH) {
                item = this.items.length;
                this.items.push({ node: n, copy: copies.get(n.id), ox: n.x, oy: n.y, lx: NaN, ly: NaN });
                this.pushedIds.add(n.id);
            }
            around.push({ node: n, item });
        }
        for (const o of around) {
            for (let i = 0; i < this.items.length; i++) {
                // two pushed nodes make one pair, kept from the lower index
                if (o.item >= 0 && o.item <= i) continue;
                const a = this.items[i].node;
                if (a === o.node) continue;
                const d = Math.hypot(a.x - o.node.x, a.y - o.node.y);
                this.pairs.push({ a: i, b: o.node, bIndex: o.item, min: Math.min(d, NODE_SEPARATION) });
            }
        }
    }

    /** One step against the ghosts' current positions; true if anything moved. */
    step(ghosts: ReadonlyArray<{ x: number; y: number }>): boolean {
        for (const it of this.items) {
            const n = it.node;
            let dx = (it.ox - n.x) * PUSH_SPRING;
            let dy = (it.oy - n.y) * PUSH_SPRING;
            for (const g of ghosts) {
                let ux = n.x - g.x;
                let uy = n.y - g.y;
                const dist = Math.hypot(ux, uy);
                if (dist >= GHOST_PUSH_CLEARANCE) continue;
                if (dist < 1e-6) {
                    ux = n.x - it.ox || 1;
                    uy = n.y - it.oy;
                }
                const len = Math.hypot(ux, uy) || 1;
                const overlap = (GHOST_PUSH_CLEARANCE - dist) * PUSH_STEP;
                dx += (ux / len) * overlap;
                dy += (uy / len) * overlap;
            }
            n.x += dx;
            n.y += dy;
        }
        for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
            for (const p of this.pairs) {
                const a = this.items[p.a].node;
                const b = p.b;
                let ux = a.x - b.x;
                let uy = a.y - b.y;
                const d = Math.hypot(ux, uy);
                if (d >= p.min) continue;
                if (d < 1e-6) (ux = 1), (uy = 0);
                const len = Math.hypot(ux, uy);
                const gap = p.min - d;
                // both give way when both are pushed, otherwise only the pushed one
                const share = p.bIndex >= 0 ? 0.5 : 1;
                a.x += (ux / len) * gap * share;
                a.y += (uy / len) * gap * share;
                if (p.bIndex >= 0) {
                    b.x -= (ux / len) * gap * share;
                    b.y -= (uy / len) * gap * share;
                }
            }
        }
        let moved = false;
        for (const it of this.items) {
            const n = it.node;
            if (Math.abs(n.x - (Number.isNaN(it.lx) ? it.ox : it.lx)) >= 0.01 || Math.abs(n.y - (Number.isNaN(it.ly) ? it.oy : it.ly)) >= 0.01) moved = true;
            if (it.copy) {
                it.copy.x = it.copy.fx = n.x;
                it.copy.y = it.copy.fy = n.y;
            }
            it.lx = n.x;
            it.ly = n.y;
        }
        return moved;
    }

    /**
     * Puts pushed nodes back; one that moved since the last step (dragged,
     * re-laid out) is left alone. True if anything moved.
     */
    restore(): boolean {
        let moved = false;
        for (const it of this.items) {
            const n = it.node;
            if (n.x !== it.lx || n.y !== it.ly) continue;
            if (n.x === it.ox && n.y === it.oy) continue;
            n.x = it.ox;
            n.y = it.oy;
            moved = true;
        }
        this.items = [];
        return moved;
    }
}
