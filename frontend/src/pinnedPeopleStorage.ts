
export type PinnedPosition = [number, number];

type StoredEntry = { id: string; x?: number; y?: number };

export class PinnedPeopleStorage {
    private storageKey: string;
    private items: Map<string, PinnedPosition | null>;

    constructor(stemmaId: string) {
        this.storageKey = `pinned.${stemmaId}`;
        this.items = new Map();
    }

    load() {
        this.items = new Map();
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed?.items)) return;
            for (const entry of parsed.items) {
                if (typeof entry === "string") {
                    this.items.set(entry, null);
                } else if (entry && typeof entry.id === "string") {
                    const pos = typeof entry.x === "number" && typeof entry.y === "number"
                        ? [entry.x, entry.y] as PinnedPosition
                        : null;
                    this.items.set(entry.id, pos);
                }
            }
        } catch {
            // ignore corrupted storage
        }
    }

    private save() {
        const items: StoredEntry[] = [...this.items.entries()].map(([id, pos]) =>
            pos ? { id, x: pos[0], y: pos[1] } : { id }
        );
        localStorage.setItem(this.storageKey, JSON.stringify({ items }));
    }

    add(personId: string) {
        if (!this.items.has(personId)) {
            this.items.set(personId, null);
            this.save();
        }
        return this;
    }

    remove(personId: string) {
        if (this.items.delete(personId)) this.save();
        return this;
    }

    updatePosition(personId: string, x: number, y: number) {
        if (!this.items.has(personId)) return this;
        this.items.set(personId, [x, y]);
        this.save();
        return this;
    }

    allPinned(): string[] {
        return [...this.items.keys()];
    }

    isPinned(personId: string): boolean {
        return this.items.has(personId);
    }

    getPosition(personId: string): PinnedPosition | null {
        return this.items.get(personId) ?? null;
    }
}
