import * as d3 from "d3";

export function makeNodesAndRelations(people, families) {
    let nodes = [
        ...people.map((p) => ({
            id: normalizeId("person", p.id),
            name: p.name,
            type: "person",
        })),
        ...families.map((f) => ({
            id: normalizeId("family", f.id),
            type: "family",
        })),
    ];

    let famlyToChildren = families.flatMap((f) =>
        f.children.map((c) => ({
            id: `${f.id}_${c}`,
            source: normalizeId("family", f.id),
            target: normalizeId("person", c),
            type: "familyToChild",
        }))
    );

    let spouseToFamily = families.flatMap((f) =>
        f.parents.map((p) => ({
            id: `${p}_${f.id}`,
            source: normalizeId("person", p),
            target: normalizeId("family", f.id),
            type: "spouseToFamily",
        })))

    let relations = [...famlyToChildren, ...spouseToFamily];

    return [nodes, relations]
}

let sessionPositions = new Map()
let cachedStemmaId = null
let activeLayoutCache = null

export function setSessionPosition(nodeId, x, y) {
    sessionPositions.set(nodeId, [x, y])
}

export function resetSessionPositions(stemmaId) {
    if (cachedStemmaId !== stemmaId) {
        sessionPositions = new Map()
        cachedStemmaId = stemmaId
    }
}

export function setActiveLayoutCache(cache) {
    activeLayoutCache = cache || null
}

/**
 * forceCollide restricted to datums that carry an explicit `r`.
 *
 * Real nodes have no `r`; only ghost nodes and their focused neighbours get
 * one (see ghostSim.ts). The previous `forceCollide().radius(d => d.r * 20)`
 * produced NaN radii for every real node: such pairs never collided, but NaN
 * also disabled the quadtree pruning, turning every tick into an O(n²) walk
 * (~70% of main-thread time on a 1000-person stemma). Filtering the datums at
 * initialize() time keeps the exact same collision pairs without the cost.
 */
export function forceCollideSized(radius) {
    const inner = d3.forceCollide().radius(radius);
    let active = false;
    function force(alpha) {
        if (active) inner(alpha);
    }
    force.initialize = (nodes, random) => {
        const sized = nodes.filter((n) => n.r != null);
        active = sized.length > 1;
        inner.initialize(sized, random);
    };
    force.radius = (...args) => (args.length ? (inner.radius(...args), force) : inner.radius());
    return force;
}

/** Ticks with every |velocity| below this many world units before a self-sustaining sim is let to settle. */
const SETTLE_VELOCITY = 0.02;
const SETTLE_TICKS = 30;

export function configureSimulation(nodes, relations, width, height, onTick, onEnd) {
    const sim = d3
        .forceSimulation(nodes)
        .force(
            "link",
            d3.forceLink(relations).id((node) => node.id).strength(2).distance(85)
        )
        .force("x", d3.forceX().x(width * 0.5).strength(0.05))
        .force("y", d3.forceY().y(height * 0.5).strength(0.05))
        .force("collide", forceCollideSized((d) => d.r * 20))
        .force("repelForce", d3.forceManyBody().strength(-1500).distanceMin(85))
        .velocityDecay(0.8);

    let calmTicks = 0;
    sim.on("tick", () => {
        let maxV = 0;
        for (const d of sim.nodes()) {
            if (d.type !== "person" && d.type !== "family") continue;
            sessionPositions.set(d.id, [d.x, d.y]);
            if (activeLayoutCache) activeLayoutCache.set(d.id, d.x, d.y, d.vx ?? 0, d.vy ?? 0);
            const v = Math.max(Math.abs(d.vx ?? 0), Math.abs(d.vy ?? 0));
            if (v > maxV) maxV = v;
        }
        // A positive alphaTarget keeps the sim alive forever, re-rendering a
        // graph that no longer moves. Once nothing has moved for a while, let
        // alpha decay so the normal "end" path (label layout, cache save) runs.
        calmTicks = maxV < SETTLE_VELOCITY ? calmTicks + 1 : 0;
        if (calmTicks >= SETTLE_TICKS && sim.alphaTarget() > 0) {
            calmTicks = 0;
            sim.alphaTarget(0).alpha(0);
        }
        onTick?.();
    });

    sim.on("end", () => {
        calmTicks = 0;
        onEnd?.();
        if (activeLayoutCache) activeLayoutCache.save();
    });

    return sim;
}

export function updateSimulation(simulation, nodes, relations) {
    simulation.nodes(nodes)
    simulation.force("link").links(relations)
    simulation.velocityDecay(0.8)
    simulation.alphaTarget(0.3).restart()
}

export const PERSON_PREFIX = "person_";
export const FAMILY_PREFIX = "family_";

export function normalizeId(suffix, id) {
    return `${suffix}_${id}`
}

export function denormalizeId(id) {
    return id.split("_")[1]
}

/**
 * Assigns starting coordinates to every node: pinned position, then cached
 * layout, then this session's last position, then the generational initial
 * layout, then the viewport centre.
 */
export function assignInitialPositions(nodes, width, height, initialPositions, pinnedPeople, ignoreCache) {
    nodes.forEach(n => {
        let pos;
        let vel;
        // n.hadKnownPosition: this node's position came from a stable source
        // (pinned/cache/session) — i.e. it existed in the layout before this
        // merge. Callers in edit mode use this to pin existing nodes so the
        // subsequent sim.tick() places only new nodes instead of drifting
        // the whole graph on every data change.
        n.hadKnownPosition = false;
        if (!ignoreCache) {
            if (n.type === "person" && pinnedPeople) {
                const personId = denormalizeId(n.id);
                const pinned = pinnedPeople.getPosition(personId);
                if (pinned) {
                    pos = pinned;
                    n.hadKnownPosition = true;
                }
            }
            if (!pos && activeLayoutCache && activeLayoutCache.has(n.id)) {
                const cached = activeLayoutCache.get(n.id);
                pos = [cached.x, cached.y];
                vel = [cached.vx, cached.vy];
                n.hadKnownPosition = true;
            }
            if (!pos && sessionPositions.has(n.id)) {
                pos = sessionPositions.get(n.id);
                n.hadKnownPosition = true;
            }
            if (!pos && initialPositions && initialPositions.has(n.id)) {
                pos = initialPositions.get(n.id);
            }
        }
        if (!pos) {
            pos = [width / 2, height / 2];
        }

        n.x = pos[0];
        n.y = pos[1];
        if (vel) {
            n.vx = vel[0];
            n.vy = vel[1];
        }
    })
}
