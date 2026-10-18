/**
 * Runs the stemma's force layout off the main thread.
 *
 * `createLayoutEngine` returns a Web Worker backed engine when Workers are
 * available, and otherwise (jest/jsdom, or a worker that fails to start) an
 * inline engine running the very same LayoutLoop on the main thread. The
 * caller owns the node objects (they are what the canvas draws): the engine
 * writes positions into them as the layout progresses, except for nodes the
 * main thread holds fixed (fx/fy), which stay main-thread authoritative.
 */
import { PositionSmoother } from "./positionSmoothing";
import { anchorAtRest, anchorWhereMissing, moveNodeTo, refreshAnchors, giveCollisionRadius, createLayoutSimulation, LayoutLoop, LAYOUT_SETTLE_MS, type LayoutNode, type Scheduler } from "./layoutCore";
import type { LayoutWorkerRequest, LayoutWorkerResponse } from "./layoutProtocol";
import { applyStructuredSeed, clanRegions, SEED_USES_CLAN_REGIONS } from "./structuredLayout";

export type EngineNode = LayoutNode;
export type EngineLink = { source: string | EngineNode; target: string | EngineNode };

export type LayoutCallbacks = {
    /** Positions were updated (after `ticks` simulation ticks). */
    onTick: (ticks: number) => void;
    /** The layout came to rest. */
    onEnd: () => void;
};

export interface LayoutEngine {
    readonly kind: "worker" | "inline";
    readonly center: [number, number];
    /**
     * Replace the graph and (unless `start` is false) lay it out from `alpha`.
     * With `seed`, unfixed nodes first get the structured starting layout
     * (cold start); `onTick(0)` reports the seeded positions.
     */
    setGraph(nodes: EngineNode[], links: EngineLink[], alpha: number, start?: boolean, seed?: boolean, groups?: Int32Array): void;
    /** Re-send every node's fx/fy after the caller changed pins in bulk. */
    syncFixed(): void;
    /** Re-send one node's fx/fy (drag). */
    pin(node: EngineNode): void;
    /** The user put the node here (edit-mode drag); it belongs there from now on. */
    moveTo(node: EngineNode, x: number, y: number): void;
    /** Restart with the given alpha and/or alphaTarget. */
    run(opts: { alpha?: number; alphaTarget?: number }): void;
    stop(): void;
    /** Run `ticks` ticks now and stop (edit mode: place new nodes only). */
    settle(ticks: number): void;
    isRunning(): boolean;
    destroy(): void;
}

/** Main-thread frame budget for the inline fallback (keeps 60 fps while settling). */
const INLINE_BUDGET_MS = 8;

const mainThreadScheduler: Scheduler = {
    soon: (fn) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => fn()) : setTimeout(fn, 16)),
    frame: (fn) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => fn()) : setTimeout(fn, 16)),
    now: () => performance.now(),
};

export class InlineLayoutEngine implements LayoutEngine {
    readonly kind = "inline" as const;
    private sim: ReturnType<typeof createLayoutSimulation> | null = null;
    private loop: LayoutLoop | null = null;

    constructor(readonly center: [number, number], private cb: LayoutCallbacks, private scheduler: Scheduler = mainThreadScheduler) {}

    private anchorAtEnd = false;

    setGraph(nodes: EngineNode[], links: EngineLink[], alpha: number, start = true, seed = false, groups?: Int32Array) {
        const pairs = linkPairs(nodes, links);
        const g = SEED_USES_CLAN_REGIONS && groups && groups.length === nodes.length ? groups : undefined;
        if (seed) applyStructuredSeed(nodes, pairs, this.center, g);
        else if (g) {
            const region = clanRegions(nodes.length, pairs, g);
            nodes.forEach((d, i) => (d.region = region[i]));
        }
        // A fresh star seed refines without anchors so long seed edges can shorten;
        // nodes are anchored where the layout comes to rest.
        this.anchorAtEnd = seed && !g;
        if (!this.anchorAtEnd) anchorWhereMissing(nodes);
        giveCollisionRadius(nodes);
        if (!this.sim) {
            this.sim = createLayoutSimulation(nodes, links as any, this.center[0] * 2, this.center[1] * 2);
            this.loop = new LayoutLoop(this.sim, this.scheduler, INLINE_BUDGET_MS, (t) => this.cb.onTick(t), () => {
                if (this.anchorAtEnd) {
                    this.anchorAtEnd = false;
                    anchorAtRest(this.sim!.nodes() as LayoutNode[], this.center[0] * 2, this.center[1] * 2);
                    refreshAnchors(this.sim!);
                }
                this.cb.onEnd();
            }, LAYOUT_SETTLE_MS);
        } else {
            this.sim.nodes(nodes as any);
            (this.sim.force("link") as any).links(links);
        }
        this.sim.alphaTarget(0).alpha(alpha);
        if (seed) this.cb.onTick(0);
        if (start) this.loop!.start();
        else this.loop!.stop();
    }

    syncFixed() {
        // Nodes are shared with the caller: nothing to send.
    }

    pin(node: EngineNode) {
        // released after a drag: it now belongs where it was dropped
        if (node.fx == null) {
            node.ax = node.x;
            node.ay = node.y;
            if (this.sim) refreshAnchors(this.sim);
        }
    }

    moveTo(node: EngineNode, x: number, y: number) {
        // nodes are shared with the caller
        moveNodeTo(node, x, y);
        if (this.sim) refreshAnchors(this.sim);
    }

    run(opts: { alpha?: number; alphaTarget?: number }) {
        if (!this.sim || !this.loop) return;
        if (opts.alphaTarget != null) this.sim.alphaTarget(opts.alphaTarget);
        if (opts.alpha != null) this.sim.alpha(opts.alpha);
        this.loop.start();
    }

    stop() {
        this.loop?.stop();
        this.sim?.alphaTarget(0);
    }

    settle(ticks: number) {
        this.sim?.alphaTarget(0);
        this.loop?.settle(ticks);
    }

    isRunning() {
        return !!this.loop?.isRunning;
    }

    /** The underlying simulation (tests). */
    simulation() {
        return this.sim;
    }

    destroy() {
        this.stop();
    }
}

export class WorkerLayoutEngine implements LayoutEngine {
    readonly kind = "worker" as const;
    private gen = 0;
    private nodes: EngineNode[] = [];
    private links: EngineLink[] = [];
    private running = false;
    private alpha = 1;
    private fallback: InlineLayoutEngine | null = null;
    private groups: Int32Array | undefined;
    /** Worker updates glide on screen instead of jumping (see PositionSmoother). */
    private smoother = new PositionSmoother();
    private glideFrame: number | null = null;
    /** The reply to a one-shot settle (edit mode) lands at once. */
    private landNext = false;

    constructor(
        readonly center: [number, number],
        private cb: LayoutCallbacks,
        private worker: Worker,
        private display: { frame: (fn: () => void) => unknown; now: () => number } | null = typeof requestAnimationFrame === "function"
            ? { frame: (fn) => requestAnimationFrame(fn), now: () => performance.now() }
            : null,
    ) {
        worker.onmessage = (e: MessageEvent<LayoutWorkerResponse>) => this.receive(e.data);
        worker.onerror = (e) => {
            e.preventDefault?.();
            this.fallBack(e.message || "worker error");
        };
    }

    private post(msg: LayoutWorkerRequest, transfer: Transferable[] = []) {
        if (this.fallback) return;
        this.worker.postMessage(msg, transfer);
    }

    private fallBack(reason: string) {
        if (this.fallback) return;
        console.warn(`Layout worker unavailable (${reason}); laying out on the main thread`);
        try {
            this.worker.terminate();
        } catch {
            // ignore
        }
        this.fallback = new InlineLayoutEngine(this.center, this.cb);
        if (this.nodes.length) {
            this.resolveLinksInPlace();
            this.fallback.setGraph(this.nodes, this.links, this.running ? Math.max(this.alpha, 0.1) : 0, true, false, this.groups);
            if (!this.running) this.fallback.stop();
        }
    }

    private resolveLinksInPlace() {
        const byId = new Map(this.nodes.map((n) => [n.id, n]));
        for (const l of this.links) {
            if (typeof l.source === "string") l.source = byId.get(l.source) ?? l.source;
            if (typeof l.target === "string") l.target = byId.get(l.target) ?? l.target;
        }
    }

    private fixedArrays() {
        const n = this.nodes.length;
        const fx = new Float64Array(n);
        const fy = new Float64Array(n);
        this.nodes.forEach((d, i) => {
            fx[i] = d.fx == null ? NaN : d.fx;
            fy[i] = d.fy == null ? NaN : d.fy;
        });
        return { fx, fy };
    }

    setGraph(nodes: EngineNode[], links: EngineLink[], alpha: number, start = true, seed = false, groups?: Int32Array) {
        this.smoother.finish(this.nodes);
        this.nodes = nodes;
        this.links = links;
        this.alpha = alpha;
        this.running = start;
        this.groups = groups;
        if (this.fallback) return this.fallback.setGraph(nodes, links, alpha, start, seed, groups);
        this.gen++;
        const n = nodes.length;
        const index = new Map(nodes.map((d, i) => [d.id, i]));
        const x = new Float64Array(n);
        const y = new Float64Array(n);
        const vx = new Float64Array(n);
        const vy = new Float64Array(n);
        nodes.forEach((d, i) => {
            x[i] = d.x;
            y[i] = d.y;
            vx[i] = d.vx ?? 0;
            vy[i] = d.vy ?? 0;
        });
        const { fx, fy } = this.fixedArrays();
        const idOf = (e: string | EngineNode) => (typeof e === "string" ? e : e.id);
        const pairs: number[] = [];
        for (const l of links) {
            const s = index.get(idOf(l.source));
            const t = index.get(idOf(l.target));
            if (s != null && t != null) pairs.push(s, t);
        }
        const linkIdx = new Int32Array(pairs);
        const groupArr = groups && groups.length === n ? Int32Array.from(groups) : new Int32Array(0);
        const axArr = Float64Array.from(nodes, (d) => (d.ax != null && Number.isFinite(d.ax) ? d.ax : NaN));
        const ayArr = Float64Array.from(nodes, (d) => (d.ay != null && Number.isFinite(d.ay) ? d.ay : NaN));
        this.post(
            {
                type: "graph",
                gen: this.gen,
                ids: nodes.map((d) => d.id),
                x, y, vx, vy, fx, fy,
                links: linkIdx,
                width: this.center[0] * 2,
                height: this.center[1] * 2,
                alpha,
                start,
                seed,
                groups: groupArr,
                ax: axArr,
                ay: ayArr,
            },
            [x.buffer, y.buffer, vx.buffer, vy.buffer, fx.buffer, fy.buffer, linkIdx.buffer, groupArr.buffer, axArr.buffer, ayArr.buffer],
        );
    }

    syncFixed() {
        if (this.fallback) return;
        const { fx, fy } = this.fixedArrays();
        this.post({ type: "fixed", gen: this.gen, fx, fy }, [fx.buffer, fy.buffer]);
    }

    pin(node: EngineNode) {
        // released after a drag: it now belongs where it was dropped
        if (node.fx == null) {
            node.ax = node.x;
            node.ay = node.y;
        }
        if (this.fallback) return this.fallback.pin(node);
        const i = this.nodes.indexOf(node);
        if (i < 0) return;
        this.post({ type: "pin", gen: this.gen, index: i, fx: node.fx ?? null, fy: node.fy ?? null });
    }

    moveTo(node: EngineNode, x: number, y: number) {
        moveNodeTo(node, x, y);
        if (this.fallback) return this.fallback.moveTo(node, x, y);
        const i = this.nodes.indexOf(node);
        if (i < 0) return;
        this.post({ type: "move", gen: this.gen, index: i, x, y });
    }

    run(opts: { alpha?: number; alphaTarget?: number }) {
        this.running = true;
        if (opts.alpha != null) this.alpha = opts.alpha;
        if (this.fallback) return this.fallback.run(opts);
        this.post({ type: "run", gen: this.gen, alpha: opts.alpha ?? null, alphaTarget: opts.alphaTarget ?? null });
    }

    stop() {
        this.running = false;
        if (this.fallback) return this.fallback.stop();
        this.post({ type: "stop", gen: this.gen });
    }

    settle(ticks: number) {
        this.running = false;
        if (this.fallback) return this.fallback.settle(ticks);
        this.landNext = true;
        this.post({ type: "settle", gen: this.gen, ticks });
    }

    isRunning() {
        return this.fallback ? this.fallback.isRunning() : this.running;
    }

    private receive(msg: LayoutWorkerResponse) {
        if (this.fallback) return;
        if (msg.type === "error") {
            this.fallBack(msg.message);
            return;
        }
        if (msg.gen !== this.gen) return;
        if (msg.type === "positions") {
            const { x, y, vx, vy } = msg;
            const nodes = this.nodes;
            // a seed, a settle (or no display loop) lands at once; ordinary updates glide
            const glide = this.display != null && !msg.ax && !this.landNext;
            this.landNext = false;
            if (glide) this.smoother.target(nodes, x, y, this.display!.now());
            else this.smoother.finish(nodes);
            for (let i = 0; i < nodes.length && i < x.length; i++) {
                const d = nodes[i];
                // Main-thread pins (drag, edit mode) win over in-flight worker positions.
                if (d.fx == null) {
                    if (!glide) d.x = x[i];
                    d.vx = vx[i];
                }
                if (d.fy == null) {
                    if (!glide) d.y = y[i];
                    d.vy = vy[i];
                }
            }
            if (msg.ax && msg.ay) {
                // positions right after a structured seed: also the anchors
                for (let i = 0; i < nodes.length && i < msg.ax.length; i++) {
                    if (Number.isFinite(msg.ax[i])) nodes[i].ax = msg.ax[i];
                    if (Number.isFinite(msg.ay[i])) nodes[i].ay = msg.ay[i];
                }
            }
            this.alpha = msg.alpha;
            if (glide) {
                this.smoother.step(nodes, this.display!.now());
                this.scheduleGlide();
            }
            this.cb.onTick(msg.ticks);
        } else if (msg.type === "end") {
            this.landGlide();
            this.running = false;
            this.cb.onEnd();
        }
    }

    private scheduleGlide() {
        if (this.glideFrame != null || !this.display) return;
        this.glideFrame = 1;
        this.display.frame(() => {
            this.glideFrame = null;
            if (!this.smoother.gliding) return;
            const more = this.smoother.step(this.nodes, this.display!.now());
            this.cb.onTick(0);
            if (more) this.scheduleGlide();
        });
    }

    /** Put nodes where the worker last said (layout end, new graph). */
    private landGlide() {
        if (!this.smoother.gliding) return;
        this.smoother.finish(this.nodes);
        this.cb.onTick(0);
    }

    destroy() {
        try {
            this.worker.terminate();
        } catch {
            // ignore
        }
        this.fallback?.destroy();
    }
}

/** [source, target] node-index pairs of `links`. */
function linkPairs(nodes: EngineNode[], links: EngineLink[]): number[] {
    const index = new Map(nodes.map((d, i) => [d.id, i]));
    const idOf = (e: string | EngineNode) => (typeof e === "string" ? e : e.id);
    const pairs: number[] = [];
    for (const l of links) {
        const s = index.get(idOf(l.source));
        const t = index.get(idOf(l.target));
        if (s != null && t != null) pairs.push(s, t);
    }
    return pairs;
}

/**
 * Worker-backed engine if a worker can be started from `workerSource`, else
 * the inline engine.
 */
export function createLayoutEngine(center: [number, number], cb: LayoutCallbacks, workerSource: string | null): LayoutEngine {
    if (workerSource && typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL?.createObjectURL === "function") {
        try {
            const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
            const worker = new Worker(url);
            URL.revokeObjectURL(url);
            return new WorkerLayoutEngine(center, cb, worker);
        } catch (err) {
            console.warn("Layout worker could not start; laying out on the main thread", err);
        }
    }
    return new InlineLayoutEngine(center, cb);
}
