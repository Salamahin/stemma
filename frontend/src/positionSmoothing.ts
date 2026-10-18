/**
 * Smooths worker layout updates on screen. The worker posts positions at its
 * own pace — on a phone a tick of a big graph can take tens of milliseconds,
 * so updates arrive every few frames and nodes jumped in steps while a finger
 * dragged someone. Each update instead becomes a glide, from where the nodes
 * are drawn now to the new positions, over about the interval between
 * updates: motion stays continuous at the cost of ~one update of latency.
 * Pinned nodes (dragged, edit mode) belong to the main thread and are skipped.
 */
type Positioned = { x: number; y: number; fx?: number | null; fy?: number | null };

const MIN_GLIDE_MS = 16;
const MAX_GLIDE_MS = 120;

export class PositionSmoother {
    private fromX = new Float64Array(0);
    private fromY = new Float64Array(0);
    private toX = new Float64Array(0);
    private toY = new Float64Array(0);
    private t0 = 0;
    private glideMs = 33;
    private lastAt = -1;
    private active = false;

    get gliding() {
        return this.active;
    }

    /** New positions from the worker at `now`. */
    target(nodes: ReadonlyArray<Positioned>, x: ArrayLike<number>, y: ArrayLike<number>, now: number) {
        const n = Math.min(nodes.length, x.length, y.length);
        if (this.lastAt >= 0) {
            // follow the update interval, smoothed, within bounds
            const gap = now - this.lastAt;
            this.glideMs = Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, this.glideMs * 0.7 + gap * 0.3));
        }
        this.lastAt = now;
        if (this.toX.length !== n) {
            this.fromX = new Float64Array(n);
            this.fromY = new Float64Array(n);
            this.toX = new Float64Array(n);
            this.toY = new Float64Array(n);
        }
        for (let i = 0; i < n; i++) {
            this.fromX[i] = nodes[i].x;
            this.fromY[i] = nodes[i].y;
            this.toX[i] = x[i];
            this.toY[i] = y[i];
        }
        this.t0 = now;
        this.active = true;
    }

    /** Writes the positions for `now`; false once the nodes have arrived. */
    step(nodes: Positioned[], now: number): boolean {
        if (!this.active) return false;
        const a = Math.min(1, Math.max(0, (now - this.t0) / this.glideMs));
        this.write(nodes, a);
        if (a >= 1) this.active = false;
        return this.active;
    }

    /** Jumps to the latest positions (layout end, a new graph). */
    finish(nodes: Positioned[]) {
        if (this.active) this.write(nodes, 1);
        this.active = false;
        this.lastAt = -1;
    }

    private write(nodes: Positioned[], a: number) {
        const n = Math.min(nodes.length, this.toX.length);
        for (let i = 0; i < n; i++) {
            const d = nodes[i];
            if (d.fx == null) d.x = this.fromX[i] + (this.toX[i] - this.fromX[i]) * a;
            if (d.fy == null) d.y = this.fromY[i] + (this.toY[i] - this.fromY[i]) * a;
        }
    }
}
