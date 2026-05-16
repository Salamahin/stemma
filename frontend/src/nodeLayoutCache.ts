export type CachedNodeState = {
    x: number;
    y: number;
    vx: number;
    vy: number;
};

const SAVE_DEBOUNCE_MS = 500;

export class NodeLayoutCache {
    private storageKey: string;
    private items: Map<string, CachedNodeState>;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(stemmaId: string) {
        this.storageKey = `nodeLayout.${stemmaId}`;
        this.items = new Map();
    }

    load() {
        this.items = new Map();
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            const items = parsed?.items;
            if (!items || typeof items !== "object") return;
            for (const [id, entry] of Object.entries(items)) {
                if (!entry || typeof entry !== "object") continue;
                const e = entry as Partial<CachedNodeState>;
                if (typeof e.x !== "number" || typeof e.y !== "number") continue;
                this.items.set(id, {
                    x: e.x,
                    y: e.y,
                    vx: typeof e.vx === "number" ? e.vx : 0,
                    vy: typeof e.vy === "number" ? e.vy : 0,
                });
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
        localStorage.setItem(this.storageKey, JSON.stringify({ items }));
    }

    has(nodeId: string): boolean {
        return this.items.has(nodeId);
    }

    get(nodeId: string): CachedNodeState | null {
        return this.items.get(nodeId) ?? null;
    }

    set(nodeId: string, x: number, y: number, vx = 0, vy = 0) {
        this.items.set(nodeId, { x, y, vx, vy });
        this.scheduleSave();
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
