/**
 * Worker-side message handling, kept separate from the worker entry so it can
 * be unit-tested with a fake `post`/scheduler.
 */
import { anchorAtRest, anchorWhereMissing, moveNodeTo, refreshAnchors, giveCollisionRadius, createLayoutSimulation, LayoutLoop, LAYOUT_SETTLE_MS, type LayoutNode, type Scheduler } from "./layoutCore";
import { applyStructuredSeed, clanRegions, SEED_USES_CLAN_REGIONS } from "./structuredLayout";
import type { LayoutWorkerRequest, LayoutWorkerResponse } from "./layoutProtocol";

/** Worker time per batch before positions are posted back (≈ one frame). */
export const WORKER_BUDGET_MS = 12;

export class LayoutWorkerHost {
    private gen = 0;
    private nodes: LayoutNode[] = [];
    private sim: ReturnType<typeof createLayoutSimulation> | null = null;
    private loop: LayoutLoop | null = null;

    constructor(
        private post: (msg: LayoutWorkerResponse, transfer: Transferable[]) => void,
        private scheduler: Scheduler,
    ) {}

    handle(msg: LayoutWorkerRequest) {
        try {
            this.dispatch(msg);
        } catch (err) {
            this.post({ type: "error", message: String((err as Error)?.message ?? err) }, []);
        }
    }

    private dispatch(msg: LayoutWorkerRequest) {
        if (msg.type === "graph") return this.setGraph(msg);
        if (msg.gen !== this.gen || !this.sim || !this.loop) return;
        switch (msg.type) {
            case "fixed":
                this.nodes.forEach((d, i) => {
                    d.fx = Number.isNaN(msg.fx[i]) ? null : msg.fx[i];
                    d.fy = Number.isNaN(msg.fy[i]) ? null : msg.fy[i];
                });
                break;
            case "pin": {
                const d = this.nodes[msg.index];
                if (d) {
                    d.fx = msg.fx;
                    d.fy = msg.fy;
                    // released after a drag: it now belongs where it was dropped
                    if (msg.fx == null) {
                        d.ax = d.x;
                        d.ay = d.y;
                        if (this.sim) refreshAnchors(this.sim);
                    }
                }
                break;
            }
            case "move": {
                const d = this.nodes[msg.index];
                if (d) {
                    moveNodeTo(d, msg.x, msg.y);
                    if (this.sim) refreshAnchors(this.sim);
                }
                break;
            }
            case "run":
                if (msg.alphaTarget != null) this.sim.alphaTarget(msg.alphaTarget);
                if (msg.alpha != null) this.sim.alpha(msg.alpha);
                this.loop.start();
                break;
            case "stop":
                this.loop.stop();
                this.sim.alphaTarget(0);
                break;
            case "settle":
                this.sim.alphaTarget(0);
                this.loop.settle(msg.ticks);
                break;
        }
    }

    private anchorAtEnd = false;

    private setGraph(msg: Extract<LayoutWorkerRequest, { type: "graph" }>) {
        this.loop?.stop();
        this.gen = msg.gen;
        this.nodes = msg.ids.map((id, i) => ({
            id,
            x: msg.x[i],
            y: msg.y[i],
            vx: msg.vx[i],
            vy: msg.vy[i],
            fx: Number.isNaN(msg.fx[i]) ? null : msg.fx[i],
            fy: Number.isNaN(msg.fy[i]) ? null : msg.fy[i],
            ax: msg.ax && Number.isFinite(msg.ax[i]) ? msg.ax[i] : undefined,
            ay: msg.ay && Number.isFinite(msg.ay[i]) ? msg.ay[i] : undefined,
        }));
        const groups = SEED_USES_CLAN_REGIONS && msg.groups && msg.groups.length === this.nodes.length ? msg.groups : undefined;
        if (msg.seed) applyStructuredSeed(this.nodes, msg.links, [msg.width / 2, msg.height / 2], groups);
        else if (groups) {
            const region = clanRegions(this.nodes.length, msg.links, groups);
            this.nodes.forEach((d, i) => (d.region = region[i]));
        }
        // A fresh star seed refines without anchors so long seed edges can shorten;
        // nodes are anchored where the layout comes to rest (see onLayoutEnd).
        this.anchorAtEnd = !!msg.seed && !groups;
        if (!this.anchorAtEnd) anchorWhereMissing(this.nodes);
        giveCollisionRadius(this.nodes);
        const links = [];
        for (let i = 0; i < msg.links.length; i += 2) {
            links.push({ source: this.nodes[msg.links[i]], target: this.nodes[msg.links[i + 1]] });
        }
        this.sim = createLayoutSimulation(this.nodes, links, msg.width, msg.height);
        this.sim.alpha(msg.alpha);
        const gen = this.gen;
        this.loop = new LayoutLoop(
            this.sim,
            this.scheduler,
            WORKER_BUDGET_MS,
            (ticks) => this.postPositions(gen, ticks),
            () => {
                if (this.anchorAtEnd) {
                    this.anchorAtEnd = false;
                    anchorAtRest(this.nodes, msg.width, msg.height);
                    if (this.sim) refreshAnchors(this.sim);
                    this.postPositions(gen, 0, true);
                }
                this.post({ type: "end", gen }, []);
            },
            LAYOUT_SETTLE_MS,
        );
        // show the seed straight away, before the first refine batch
        if (msg.seed) this.postPositions(gen, 0, true);
        if (msg.start) this.loop.start();
    }

    private postPositions(gen: number, ticks: number, withAnchors = false) {
        const n = this.nodes.length;
        const x = new Float64Array(n);
        const y = new Float64Array(n);
        const vx = new Float64Array(n);
        const vy = new Float64Array(n);
        this.nodes.forEach((d, i) => {
            x[i] = d.x;
            y[i] = d.y;
            vx[i] = d.vx ?? 0;
            vy[i] = d.vy ?? 0;
        });
        if (withAnchors) {
            const ax = Float64Array.from(this.nodes, (d) => d.ax ?? NaN);
            const ay = Float64Array.from(this.nodes, (d) => d.ay ?? NaN);
            this.post({ type: "positions", gen, ticks, alpha: this.sim!.alpha(), x, y, vx, vy, ax, ay }, [x.buffer, y.buffer, vx.buffer, vy.buffer, ax.buffer, ay.buffer]);
            return;
        }
        this.post({ type: "positions", gen, ticks, alpha: this.sim!.alpha(), x, y, vx, vy }, [x.buffer, y.buffer, vx.buffer, vy.buffer]);
    }
}
