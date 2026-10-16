/**
 * The force layout itself, free of DOM access so it runs both in the layout
 * Web Worker (layout.worker.ts) and, as a fallback, on the main thread.
 */
import * as d3 from "d3";

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
export function forceCollideSized(radius: (d: any) => number) {
    const inner = d3.forceCollide().radius(radius);
    let active = false;
    function force(alpha: number) {
        if (active) inner(alpha);
    }
    force.initialize = (nodes: any[], random: () => number) => {
        const sized = nodes.filter((n) => n.r != null);
        active = sized.length > 1;
        (inner as any).initialize(sized, random);
    };
    force.radius = (...args: any[]) => (args.length ? ((inner as any).radius(...args), force) : inner.radius());
    return force;
}

/**
 * Layout tuning (see e2e/bench/layoutExperiment.mjs). The old setup —
 * velocityDecay 0.8 plus a permanent alphaTarget 0.1 — crept towards its
 * equilibrium for minutes and never stopped. Lower friction reaches nearly the
 * same picture (size, aspect, overlaps) in ~200 ticks and then ends.
 */
export const LAYOUT_TICKS = 200;
export const LAYOUT_VELOCITY_DECAY = 0.3;
export const LAYOUT_ALPHA_DECAY = 1 - Math.pow(0.001, 1 / LAYOUT_TICKS);
export const LAYOUT_THETA = 1.2;
/** Reheat for data changes / leaving edit mode: a gentle refine, not a full relayout. */
export const LAYOUT_REHEAT_ALPHA = 0.3;
/** Start alpha when every node has a remembered position: a short, gentle refine. */
export const LAYOUT_REFINE_ALPHA = 0.02;

export type LayoutNode = {
    id: string;
    type?: string;
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
    r?: number;
    index?: number;
};

export type LayoutLink = { source: string | LayoutNode; target: string | LayoutNode };

/** The forces every layout of the stemma uses (main layout and ghost burst alike). */
export function applyLayoutForces(sim: d3.Simulation<any, any>, links: LayoutLink[], width: number, height: number) {
    return sim
        .force("link", d3.forceLink(links as any).id((n: any) => n.id).strength(2).distance(85))
        .force("x", d3.forceX().x(width * 0.5).strength(0.05))
        .force("y", d3.forceY().y(height * 0.5).strength(0.05))
        .force("collide", forceCollideSized((d: any) => d.r * 20) as any)
        .force("repelForce", d3.forceManyBody().strength(-1500).distanceMin(85).theta(LAYOUT_THETA));
}

/** A stopped simulation with the stemma's forces and tuning; drive it with LayoutLoop. */
export function createLayoutSimulation(nodes: LayoutNode[], links: LayoutLink[], width: number, height: number) {
    const sim = d3.forceSimulation(nodes as any).stop();
    applyLayoutForces(sim, links, width, height);
    return sim.velocityDecay(LAYOUT_VELOCITY_DECAY).alphaDecay(LAYOUT_ALPHA_DECAY);
}

export type Scheduler = {
    /** Run `fn` as soon as possible (next frame on the main thread, next task in a worker). */
    soon(fn: () => void): unknown;
    /** Run `fn` after about one frame (interactive pacing). */
    frame(fn: () => void): unknown;
    now(): number;
};

/**
 * Drives a simulation without d3's timer:
 * - settling (alphaTarget 0): as many ticks as fit in `budgetMs`, then yield,
 *   until alpha drops below alphaMin → `onEnd`;
 * - interactive (alphaTarget > 0, e.g. a node drag): one tick per frame, so a
 *   held drag does not spin.
 * `onTick` fires once per batch, with the number of ticks it ran.
 */
export class LayoutLoop {
    private running = false;
    private pending = false;
    private generation = 0;

    constructor(
        public sim: d3.Simulation<any, any>,
        private scheduler: Scheduler,
        private budgetMs: number,
        private onTick: (ticks: number) => void,
        private onEnd: () => void,
    ) {}

    get isRunning() {
        return this.running;
    }

    start() {
        this.running = true;
        this.schedule(true);
    }

    stop() {
        this.running = false;
        this.generation++;
        this.pending = false;
    }

    /** Runs `n` ticks synchronously (edit mode: place new nodes), then stops. */
    settle(n: number) {
        this.stop();
        this.sim.tick(n);
        this.onTick(n);
    }

    private schedule(immediate: boolean) {
        if (this.pending || !this.running) return;
        this.pending = true;
        const gen = this.generation;
        const run = () => {
            if (gen !== this.generation) return;
            this.pending = false;
            this.step();
        };
        if (immediate || this.sim.alphaTarget() === 0) this.scheduler.soon(run);
        else this.scheduler.frame(run);
    }

    private step() {
        if (!this.running) return;
        const sim = this.sim;
        let ticks = 0;
        if (sim.alphaTarget() > 0) {
            sim.tick();
            ticks = 1;
        } else {
            const start = this.scheduler.now();
            do {
                sim.tick();
                ticks++;
            } while (sim.alpha() >= sim.alphaMin() && this.scheduler.now() - start < this.budgetMs);
        }
        this.onTick(ticks);
        if (sim.alpha() < sim.alphaMin() && sim.alphaTarget() === 0) {
            this.running = false;
            this.onEnd();
            return;
        }
        this.schedule(false);
    }
}
