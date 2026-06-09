import * as d3 from "d3";
import { normalizeId } from "../graphTools";
import type { StemmaIndex } from "../stemmaIndex";
import type { FocusedId } from "./focusGesture";
import {
    FOCUSED_FAMILY_REF,
    immediateNeighborIds,
    realFamilyIdFromRef,
    type GhostLayout,
} from "./ghostHelpers";

/**
 * Force tuning for the ghost-mode mini-simulation. The topology mirrors the
 * main edit-off chart (link + repulsion + centring) but the decays are heavy
 * so the system settles in well under a second: ~20 ticks (333 ms @ 60fps)
 * to alpha < 0.01, ~31 ticks (517 ms) to alphaMin (default 0.001).
 */
export const GHOST_SIM_LINK_DISTANCE = 85;
export const GHOST_SIM_LINK_STRENGTH = 2;
export const GHOST_SIM_CHARGE_STRENGTH = -800;
export const GHOST_SIM_CENTER_STRENGTH = 0.15;
export const GHOST_SIM_VELOCITY_DECAY = 0.85;
export const GHOST_SIM_ALPHA_DECAY = 0.2;
export const GHOST_SIM_COLLIDE_RADIUS = 36;

export type GhostSimNode = {
    id: string;
    x: number;
    y: number;
    fx?: number | null;
    fy?: number | null;
    isGhost: boolean;
};

export type GhostSimLink = { source: string; target: string };

export type GhostSimGraph = {
    nodes: GhostSimNode[];
    links: GhostSimLink[];
    focusedDomId: string;
};

export type GhostSimSeed = {
    origin: { x: number; y: number };
    /** dom-id (normalizeId) -> current position. Must already exclude pending entities and focused. */
    neighborPositions: Map<string, { x: number; y: number }>;
    /** ghost-id (raw layout id) -> seed position. */
    ghostPositions: Map<string, { x: number; y: number }>;
};

/**
 * Build the (nodes, links) graph used by the ghost sim. Topology:
 *   - focused (pinned at origin)
 *   - every 1-hop real neighbour (unfrozen)
 *   - every ghost family + ghost person (unfrozen, seeded at plan position)
 * Links replicate the real spouse→family / family→child relations among the
 * focused-plus-neighbours subset, plus the ghost relations declared in
 * `layout.anchorEdges` and `layout.persons[*].familyId`.
 */
export function buildGhostSimGraph(
    focusedId: FocusedId,
    stemmaIndex: StemmaIndex,
    layout: GhostLayout,
    seed: GhostSimSeed,
): GhostSimGraph {
    const focusedDomId = normalizeId(focusedId.kind, focusedId.id);
    const nodes: GhostSimNode[] = [];
    const present = new Set<string>();

    nodes.push({
        id: focusedDomId,
        x: seed.origin.x,
        y: seed.origin.y,
        fx: seed.origin.x,
        fy: seed.origin.y,
        isGhost: false,
    });
    present.add(focusedDomId);

    for (const [domId, pos] of seed.neighborPositions) {
        if (present.has(domId)) continue;
        nodes.push({ id: domId, x: pos.x, y: pos.y, isGhost: false });
        present.add(domId);
    }

    for (const f of layout.families) {
        const pos = seed.ghostPositions.get(f.id);
        if (!pos) continue;
        nodes.push({ id: f.id, x: pos.x, y: pos.y, isGhost: true });
        present.add(f.id);
    }
    for (const p of layout.persons) {
        const pos = seed.ghostPositions.get(p.id);
        if (!pos) continue;
        nodes.push({ id: p.id, x: pos.x, y: pos.y, isGhost: true });
        present.add(p.id);
    }

    const links: GhostSimLink[] = [];
    const addLink = (source: string, target: string) => {
        if (!present.has(source) || !present.has(target)) return;
        links.push({ source, target });
    };

    const familyIds: string[] = focusedId.kind === "person"
        ? stemmaIndex.relatedFamilies(focusedId.id).map((f) => f.id)
        : [focusedId.id];

    const visited = new Set<string>();
    for (const fid of familyIds) {
        if (visited.has(fid)) continue;
        visited.add(fid);
        const fam = stemmaIndex.family(fid);
        if (!fam) continue;
        const famDom = normalizeId("family", fid);
        for (const pid of fam.parents ?? []) addLink(normalizeId("person", pid), famDom);
        for (const cid of fam.children ?? []) addLink(famDom, normalizeId("person", cid));
    }

    for (const e of layout.anchorEdges) {
        if (e.focusedRole === "parent") addLink(focusedDomId, e.familyId);
        else addLink(e.familyId, focusedDomId);
    }

    for (const p of layout.persons) {
        let famNode: string | null = null;
        if (p.familyId === FOCUSED_FAMILY_REF) famNode = focusedDomId;
        else if (realFamilyIdFromRef(p.familyId)) {
            famNode = normalizeId("family", realFamilyIdFromRef(p.familyId)!);
        } else {
            famNode = p.familyId;
        }
        if (p.role === "parent") addLink(p.id, famNode);
        else addLink(famNode, p.id);
    }

    return { nodes, links, focusedDomId };
}

export function configureGhostSim(
    graph: GhostSimGraph,
    origin: { x: number; y: number },
): d3.Simulation<GhostSimNode, GhostSimLink> {
    return d3
        .forceSimulation<GhostSimNode>(graph.nodes)
        .force(
            "link",
            d3
                .forceLink<GhostSimNode, GhostSimLink>(graph.links)
                .id((n) => n.id)
                .distance(GHOST_SIM_LINK_DISTANCE)
                .strength(GHOST_SIM_LINK_STRENGTH),
        )
        .force("charge", d3.forceManyBody<GhostSimNode>().strength(GHOST_SIM_CHARGE_STRENGTH))
        .force("x", d3.forceX<GhostSimNode>(origin.x).strength(GHOST_SIM_CENTER_STRENGTH))
        .force("y", d3.forceY<GhostSimNode>(origin.y).strength(GHOST_SIM_CENTER_STRENGTH))
        .force(
            "collide",
            d3.forceCollide<GhostSimNode>().radius(GHOST_SIM_COLLIDE_RADIUS).strength(0.9),
        )
        .velocityDecay(GHOST_SIM_VELOCITY_DECAY)
        .alphaDecay(GHOST_SIM_ALPHA_DECAY);
}

/** Convenience: dom-ids of the 1-hop real neighbours that should participate in the sim. */
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
