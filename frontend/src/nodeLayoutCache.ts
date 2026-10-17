export type CachedNodeState = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** Layout anchor (see layoutCore.anchorWhereMissing); absent in older payloads. */
    ax?: number;
    ay?: number;
};

const SAVE_DEBOUNCE_MS = 500;
/** Coordinates beyond this are treated as garbage (a real layout is a few 10k wide). */
const MAX_ABS_COORD = 1e7;
const MAX_ABS_VELOCITY = 1e4;

const finiteIn = (v: unknown, limit: number): v is number =>
    typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit;

/**
 * Per-viewer, per-stemma memory of node positions (localStorage), so a
 * reopened stemma appears in its previous shape and the simulation only
 * refines it. Storage is best-effort: unavailable/full/corrupt storage just
 * means a cold layout, never an error.
 */
export class NodeLayoutCache {
    private storageKey: string;
    private items: Map<string, CachedNodeState>;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    /** Layout centre (forceX/forceY target) the positions were computed for. */
    private center: [number, number] | null = null;

    constructor(stemmaId: string) {
        this.storageKey = `nodeLayout.${stemmaId}`;
        this.items = new Map();
    }

    /**
     * Loads stored positions. With `currentCenter`, positions saved for a
     * different viewport are shifted so the graph keeps its place relative to
     * the centre the forces now pull towards.
     */
    load(currentCenter?: [number, number]) {
        this.items = new Map();
        this.center = currentCenter ?? null;
        let raw: string | null = null;
        try {
            raw = localStorage.getItem(this.storageKey);
        } catch {
            return;
        }
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            const items = parsed?.items;
            if (!items || typeof items !== "object" || Array.isArray(items)) return;
            const stored = parsed?.center;
            let dx = 0;
            let dy = 0;
            if (currentCenter && Array.isArray(stored) && finiteIn(stored[0], MAX_ABS_COORD) && finiteIn(stored[1], MAX_ABS_COORD)) {
                dx = currentCenter[0] - stored[0];
                dy = currentCenter[1] - stored[1];
            }
            for (const [id, entry] of Object.entries(items)) {
                if (!entry || typeof entry !== "object") continue;
                const e = entry as Partial<CachedNodeState>;
                if (!finiteIn(e.x, MAX_ABS_COORD) || !finiteIn(e.y, MAX_ABS_COORD)) continue;
                const state: CachedNodeState = {
                    x: e.x + dx,
                    y: e.y + dy,
                    vx: finiteIn(e.vx, MAX_ABS_VELOCITY) ? e.vx : 0,
                    vy: finiteIn(e.vy, MAX_ABS_VELOCITY) ? e.vy : 0,
                };
                if (finiteIn(e.ax, MAX_ABS_COORD) && finiteIn(e.ay, MAX_ABS_COORD)) {
                    state.ax = e.ax + dx;
                    state.ay = e.ay + dy;
                }
                this.items.set(id, state);
            }
        } catch {
            // ignore corrupted storage
        }
    }

    save() {
        if (this.saveTimer != null) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        const items: Record<string, CachedNodeState> = {};
        for (const [id, state] of this.items.entries()) {
            items[id] = state;
        }
        try {
            const payload: Record<string, unknown> = { items };
            if (this.center) payload.center = this.center;
            localStorage.setItem(this.storageKey, JSON.stringify(payload));
        } catch {
            // storage full or unavailable: the layout simply is not remembered
        }
    }

    has(nodeId: string): boolean {
        return this.items.has(nodeId);
    }

    get(nodeId: string): CachedNodeState | null {
        return this.items.get(nodeId) ?? null;
    }

    set(nodeId: string, x: number, y: number, vx = 0, vy = 0, ax?: number, ay?: number) {
        if (!finiteIn(x, MAX_ABS_COORD) || !finiteIn(y, MAX_ABS_COORD)) return;
        const state: CachedNodeState = {
            x,
            y,
            vx: finiteIn(vx, MAX_ABS_VELOCITY) ? vx : 0,
            vy: finiteIn(vy, MAX_ABS_VELOCITY) ? vy : 0,
        };
        if (finiteIn(ax, MAX_ABS_COORD) && finiteIn(ay, MAX_ABS_COORD)) {
            state.ax = ax;
            state.ay = ay;
        }
        this.items.set(nodeId, state);
        this.scheduleSave();
    }

    /** Drops entries for nodes that are no longer in the stemma. */
    retain(nodeIds: Iterable<string>) {
        const keep = new Set(nodeIds);
        let changed = false;
        for (const id of [...this.items.keys()]) {
            if (!keep.has(id)) {
                this.items.delete(id);
                changed = true;
            }
        }
        if (changed) this.scheduleSave();
    }

    coverage(nodeIds: string[]): number {
        if (nodeIds.length === 0) return 0;
        const hits = nodeIds.reduce((n, id) => n + (this.items.has(id) ? 1 : 0), 0);
        return hits / nodeIds.length;
    }

    private scheduleSave() {
        if (this.saveTimer != null) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.save();
        }, SAVE_DEBOUNCE_MS);
    }
}
