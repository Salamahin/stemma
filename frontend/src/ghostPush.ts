/**
 * Edit mode: real nodes make room for the ghost affordances of a focused node.
 *
 * While the ghost burst runs, people near the ghosts are pushed out of the
 * way — off the ghost circles (and their labels), off the dashed ghost edges,
 * and real edges running through a ghost are shifted aside with their ends —
 * with a spring back to their own spot. They move on the chart itself; their
 * frozen copies in the burst simulation follow, so the ghosts collide with
 * them where they now are. The focused node stays under the pointer and
 * viewer-pinned people never move.
 *
 * They are not simply unfrozen in the burst simulation: edit mode leaves the
 * graph pinned wherever it was (rarely an equilibrium), so the full forces
 * would make neighbours drift with no ghost anywhere near.
 *
 * On blur the pushed nodes glide back home (`PushRegistry.returnStep`). A
 * focus that starts while they are still on their way back pushes them from
 * their home, not from wherever the glide had got to, so moving the pointer
 * from node to node never accumulates displacement.
 */

export type Pos = { x: number; y: number };
type Node = Pos & { id: string };
type FrozenCopy = { x: number; y: number; fx?: number | null; fy?: number | null };
export type GhostDisc = Pos & { type: string };
export type Segment = readonly [Pos, Pos];

/** Real nodes within this distance of a ghost's seed position may be pushed. */
export const GHOST_PUSH_REACH = 320;
/** Distance a pushed node keeps from a ghost person (circle + its label + padding). */
export const GHOST_PUSH_CLEARANCE = 130;
/** …from a ghost family (a small dot). */
const GHOST_FAMILY_CLEARANCE = 60;
/** …from a dashed ghost edge. */
const GHOST_EDGE_CLEARANCE = 50;
/** Distance a real edge keeps from a ghost person: its ends are shifted aside. */
const LINK_CLEARANCE = 60;
/** Closest two people may be pushed together (never closer than they were). */
export const NODE_SEPARATION = 60;
/** Share of the remaining overlap resolved per tick, and the pull back home. */
const PUSH_STEP = 0.35;
const PUSH_SPRING = 0.03;
/** Separation passes per tick (a push can shove a short chain of people). */
const SEPARATION_PASSES = 3;
/** Share of the way home covered per frame when gliding back. */
const RETURN_STEP = 0.2;

/** Where pushed nodes belong, shared by consecutive focuses on one chart. */
export class PushRegistry {
    /** home + where we last left the node (anything else moving it drops the entry). */
    private entries = new Map<Pos, { hx: number; hy: number; lx: number; ly: number }>();
    private claimed = new Set<Pos>();

    /** Home of a node about to be pushed (its current spot unless it is still gliding back). */
    claim(n: Pos): Pos {
        this.claimed.add(n);
        const e = this.entries.get(n);
        if (e && e.lx === n.x && e.ly === n.y) return { x: e.hx, y: e.hy };
        this.entries.delete(n);
        return { x: n.x, y: n.y };
    }

    /** The node was moved by a push; remember where it belongs. */
    moved(n: Pos, home: Pos) {
        this.entries.set(n, { hx: home.x, hy: home.y, lx: n.x, ly: n.y });
    }

    release(nodes: Iterable<Pos>) {
        for (const n of nodes) this.claimed.delete(n);
    }

    /** True while some released node is still away from home. */
    returning(): boolean {
        for (const n of this.entries.keys()) if (!this.claimed.has(n)) return true;
        return false;
    }

    /** Moves released nodes a step home; true if anything moved. */
    returnStep(): boolean {
        let moved = false;
        for (const [n, e] of this.entries) {
            if (this.claimed.has(n)) continue;
            if (n.x !== e.lx || n.y !== e.ly) {
                // moved by something else (drag, layout): it belongs there now
                this.entries.delete(n);
                continue;
            }
            const dx = e.hx - n.x;
            const dy = e.hy - n.y;
            if (Math.hypot(dx, dy) < 0.5) {
                n.x = e.hx;
                n.y = e.hy;
                this.entries.delete(n);
            } else {
                n.x += dx * RETURN_STEP;
                n.y += dy * RETURN_STEP;
                e.lx = n.x;
                e.ly = n.y;
            }
            moved = true;
        }
        return moved;
    }

    /** Puts every released node home at once (chart going away, layout restarting). */
    settle(): boolean {
        let moved = false;
        while (this.returning()) moved = this.returnStep() || moved;
        return moved;
    }
}

const registries = new WeakMap<object, PushRegistry>();

/** The registry of one chart (ghost layer and layout share it). */
export function pushRegistryFor(chart: object): PushRegistry {
    let r = registries.get(chart);
    if (!r) registries.set(chart, (r = new PushRegistry()));
    return r;
}

function closestOnSegment(p: Pos, a: Pos, b: Pos): Pos {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0;
    return { x: a.x + t * vx, y: a.y + t * vy };
}

type Item = { node: Pos; copy: FrozenCopy | undefined; home: Pos; dx: number; dy: number };

export class NeighbourPush<T extends Node> {
    private items: Item[] = [];
    private itemOf = new Map<Pos, number>();
    /** (pushed node, any node nearby, how close they may get); bIndex ≥ 0 when b is pushed too. */
    private pairs: Array<{ a: number; b: Pos; bIndex: number; min: number }> = [];
    /** Real edges with at least one pushable end. */
    private links: Array<{ a: Pos; b: Pos; ia: number; ib: number }> = [];
    /** Where the last step left each pushed node. */
    private lastPos = new Map<Pos, Pos>();
    /** Ids of the nodes that may be pushed. */
    readonly pushedIds = new Set<string>();

    constructor(
        nodes: ReadonlyArray<T>,
        links: ReadonlyArray<{ source: unknown; target: unknown }>,
        copies: Map<string, FrozenCopy>,
        focusedDomId: string,
        ghosts: ReadonlyArray<GhostDisc>,
        private registry: PushRegistry = new PushRegistry(),
        skip: (n: T) => boolean = () => false,
    ) {
        const toGhost = (n: Pos) => {
            let best = Infinity;
            for (const g of ghosts) best = Math.min(best, Math.hypot(n.x - g.x, n.y - g.y));
            return best;
        };
        // everyone a pushed node could end up next to
        const aroundReach = GHOST_PUSH_REACH + GHOST_PUSH_CLEARANCE + NODE_SEPARATION;
        const around: Array<{ node: Pos; item: number }> = [];
        for (const n of nodes) {
            const dist = toGhost(n);
            if (dist > aroundReach) continue;
            let item = -1;
            if (n.id !== focusedDomId && !skip(n) && dist <= GHOST_PUSH_REACH) {
                item = this.items.length;
                const home = registry.claim(n);
                this.items.push({ node: n, copy: copies.get(n.id), home, dx: 0, dy: 0 });
                this.itemOf.set(n, item);
                this.pushedIds.add(n.id);
            }
            around.push({ node: n, item });
        }
        for (const o of around) {
            for (let i = 0; i < this.items.length; i++) {
                // two pushed nodes make one pair, kept from the lower index
                if (o.item >= 0 && o.item <= i) continue;
                const it = this.items[i];
                const ob = o.item >= 0 ? this.items[o.item].home : o.node;
                const d = Math.hypot(it.home.x - ob.x, it.home.y - ob.y);
                this.pairs.push({ a: i, b: o.node, bIndex: o.item, min: Math.min(d, NODE_SEPARATION) });
            }
        }
        for (const l of links) {
            const a = l.source as Pos;
            const b = l.target as Pos;
            if (typeof a !== "object" || typeof b !== "object") continue;
            const ia = this.itemOf.get(a) ?? -1;
            const ib = this.itemOf.get(b) ?? -1;
            if (ia >= 0 || ib >= 0) this.links.push({ a, b, ia, ib });
        }
    }

    private nudge(i: number, x: number, y: number) {
        const it = this.items[i];
        it.dx += x;
        it.dy += y;
    }

    /** One step against the ghosts' (and ghost edges') current positions; true if anything moved. */
    step(ghosts: ReadonlyArray<GhostDisc>, ghostEdges: ReadonlyArray<Segment> = []): boolean {
        for (const it of this.items) {
            it.dx = (it.home.x - it.node.x) * PUSH_SPRING;
            it.dy = (it.home.y - it.node.y) * PUSH_SPRING;
        }
        this.items.forEach((it, i) => {
            const n = it.node;
            const away = (from: Pos, clearance: number) => {
                let ux = n.x - from.x;
                let uy = n.y - from.y;
                const dist = Math.hypot(ux, uy);
                if (dist >= clearance) return;
                if (dist < 1e-6) {
                    ux = n.x - it.home.x || 1;
                    uy = n.y - it.home.y;
                }
                const len = Math.hypot(ux, uy) || 1;
                const overlap = (clearance - dist) * PUSH_STEP;
                this.nudge(i, (ux / len) * overlap, (uy / len) * overlap);
            };
            for (const g of ghosts) away(g, g.type === "ghost-family" ? GHOST_FAMILY_CLEARANCE : GHOST_PUSH_CLEARANCE);
            for (const [a, b] of ghostEdges) away(closestOnSegment(n, a, b), GHOST_EDGE_CLEARANCE);
        });
        // real edges through a ghost person: shift the edge aside with its pushable ends
        for (const l of this.links) {
            for (const g of ghosts) {
                if (g.type === "ghost-family") continue;
                const c = closestOnSegment(g, l.a, l.b);
                let ux = c.x - g.x;
                let uy = c.y - g.y;
                const dist = Math.hypot(ux, uy);
                if (dist >= LINK_CLEARANCE) continue;
                if (dist < 1e-6) {
                    // perpendicular to the edge
                    ux = -(l.b.y - l.a.y);
                    uy = l.b.x - l.a.x;
                }
                const len = Math.hypot(ux, uy) || 1;
                const overlap = (LINK_CLEARANCE - dist) * PUSH_STEP;
                if (l.ia >= 0) this.nudge(l.ia, (ux / len) * overlap, (uy / len) * overlap);
                if (l.ib >= 0) this.nudge(l.ib, (ux / len) * overlap, (uy / len) * overlap);
            }
        }
        for (const it of this.items) {
            it.node.x += it.dx;
            it.node.y += it.dy;
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
            const last = this.lastPos.get(n) ?? it.home;
            if (Math.abs(n.x - last.x) >= 0.01 || Math.abs(n.y - last.y) >= 0.01) moved = true;
            this.lastPos.set(n, { x: n.x, y: n.y });
            if (it.copy) {
                it.copy.x = it.copy.fx = n.x;
                it.copy.y = it.copy.fy = n.y;
            }
            this.registry.moved(n, it.home);
        }
        return moved;
    }

    /** Focus over: the pushed nodes are free to glide home (`registry.returnStep`). */
    release() {
        this.registry.release(this.items.map((it) => it.node));
        this.items = [];
        this.pairs = [];
        this.links = [];
    }
}
