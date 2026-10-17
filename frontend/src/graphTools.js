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
/** Layout anchors seen this session (see layoutCore.anchorWhereMissing). */
let sessionAnchors = new Map()
let cachedStemmaId = null
let activeLayoutCache = null

export function setSessionPosition(nodeId, x, y) {
    sessionPositions.set(nodeId, [x, y])
}

export function resetSessionPositions(stemmaId) {
    if (cachedStemmaId !== stemmaId) {
        sessionPositions = new Map()
        sessionAnchors = new Map()
        cachedStemmaId = stemmaId
    }
}

export function setActiveLayoutCache(cache) {
    activeLayoutCache = cache || null
}

/** Remembers where every node is (this session + the per-stemma layout cache). */
export function recordPositions(nodes) {
    for (const d of nodes) {
        if (d.type !== "person" && d.type !== "family") continue;
        sessionPositions.set(d.id, [d.x, d.y]);
        if (d.ax != null && d.ay != null) sessionAnchors.set(d.id, [d.ax, d.ay]);
        if (activeLayoutCache) activeLayoutCache.set(d.id, d.x, d.y, d.vx ?? 0, d.vy ?? 0, d.ax, d.ay);
    }
}

export function saveLayoutCache() {
    if (activeLayoutCache) activeLayoutCache.save();
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
                if (cached.ax != null && cached.ay != null) {
                    n.ax = cached.ax;
                    n.ay = cached.ay;
                }
                n.hadKnownPosition = true;
            }
            if (!pos && sessionPositions.has(n.id)) {
                pos = sessionPositions.get(n.id);
                const anchor = sessionAnchors.get(n.id);
                if (anchor) {
                    n.ax = anchor[0];
                    n.ay = anchor[1];
                }
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
