import { NodeLayoutCache } from "./nodeLayoutCache";

describe("NodeLayoutCache", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        localStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("load on missing storage leaves cache empty", () => {
        const cache = new NodeLayoutCache("stemma-1");
        cache.load();
        expect(cache.has("n1")).toBe(false);
        expect(cache.get("n1")).toBeNull();
    });

    test("set/get round-trip and survives reload after save", () => {
        const cache = new NodeLayoutCache("stemma-1");
        cache.load();
        cache.set("n1", 10, 20, 0.5, -0.25);
        cache.save();

        expect(cache.get("n1")).toEqual({ x: 10, y: 20, vx: 0.5, vy: -0.25 });

        const reloaded = new NodeLayoutCache("stemma-1");
        reloaded.load();
        expect(reloaded.get("n1")).toEqual({ x: 10, y: 20, vx: 0.5, vy: -0.25 });
    });

    test("debounced save flushes after the timer fires", () => {
        const cache = new NodeLayoutCache("stemma-1");
        cache.load();
        cache.set("n1", 1, 2);
        expect(localStorage.getItem("nodeLayout.stemma-1")).toBeNull();

        jest.advanceTimersByTime(500);

        const reloaded = new NodeLayoutCache("stemma-1");
        reloaded.load();
        expect(reloaded.get("n1")).toEqual({ x: 1, y: 2, vx: 0, vy: 0 });
    });

    test("two stemmas keep separate caches", () => {
        const a = new NodeLayoutCache("stemma-a");
        const b = new NodeLayoutCache("stemma-b");
        a.set("n1", 1, 1);
        b.set("n1", 9, 9);
        a.save();
        b.save();

        const ra = new NodeLayoutCache("stemma-a");
        ra.load();
        const rb = new NodeLayoutCache("stemma-b");
        rb.load();
        expect(ra.get("n1")?.x).toBe(1);
        expect(rb.get("n1")?.x).toBe(9);
    });

    test("coverage reports fraction of cached node ids", () => {
        const cache = new NodeLayoutCache("stemma-1");
        cache.load();
        cache.set("n1", 0, 0);
        cache.set("n2", 0, 0);
        expect(cache.coverage(["n1", "n2", "n3", "n4"])).toBe(0.5);
        expect(cache.coverage([])).toBe(0);
    });

    test("entries without numeric x/y are skipped on load", () => {
        localStorage.setItem(
            "nodeLayout.stemma-1",
            JSON.stringify({ items: { n1: { x: "bad", y: 0 }, n2: { x: 5, y: 6 } } })
        );
        const cache = new NodeLayoutCache("stemma-1");
        cache.load();
        expect(cache.has("n1")).toBe(false);
        expect(cache.get("n2")).toEqual({ x: 5, y: 6, vx: 0, vy: 0 });
    });

    test("ignores corrupted localStorage payload", () => {
        localStorage.setItem("nodeLayout.stemma-1", "not-json");
        const cache = new NodeLayoutCache("stemma-1");
        cache.load();
        expect(cache.has("n1")).toBe(false);
    });

    test("non-finite or absurd coordinates are dropped, bad velocities zeroed", () => {
        localStorage.setItem(
            "nodeLayout.stemma-1",
            JSON.stringify({
                items: {
                    nan: { x: null, y: 0 },
                    huge: { x: 1e12, y: 0 },
                    ok: { x: 5, y: 6, vx: "fast", vy: 1e9 },
                },
            }),
        );
        const cache = new NodeLayoutCache("stemma-1");
        cache.load();
        expect(cache.has("nan")).toBe(false);
        expect(cache.has("huge")).toBe(false);
        expect(cache.get("ok")).toEqual({ x: 5, y: 6, vx: 0, vy: 0 });
    });

    test("payload of the wrong shape is ignored", () => {
        localStorage.setItem("nodeLayout.stemma-1", JSON.stringify({ items: [1, 2, 3] }));
        const cache = new NodeLayoutCache("stemma-1");
        expect(() => cache.load()).not.toThrow();
        expect(cache.coverage(["0", "1"])).toBe(0);
        localStorage.setItem("nodeLayout.stemma-1", JSON.stringify(null));
        expect(() => cache.load()).not.toThrow();
    });

    test("storage that throws (disabled / private mode / quota) never breaks load or save", () => {
        const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("SecurityError");
        });
        const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError");
        });
        try {
            const cache = new NodeLayoutCache("stemma-1");
            expect(() => cache.load()).not.toThrow();
            cache.set("n1", 1, 2);
            expect(() => cache.save()).not.toThrow();
            expect(() => jest.advanceTimersByTime(1000)).not.toThrow();
            expect(cache.get("n1")).toEqual({ x: 1, y: 2, vx: 0, vy: 0 });
        } finally {
            getItem.mockRestore();
            setItem.mockRestore();
        }
    });

    test("layout anchors are remembered with the positions (and shifted with the centre)", () => {
        const cache = new NodeLayoutCache("stemma-a");
        cache.load([500, 400]);
        cache.set("n1", 10, 20, 0, 0, 100, 200);
        cache.set("n2", 30, 40);
        cache.save();
        const same = new NodeLayoutCache("stemma-a");
        same.load([500, 400]);
        expect(same.get("n1")).toEqual({ x: 10, y: 20, vx: 0, vy: 0, ax: 100, ay: 200 });
        expect(same.get("n2")).toEqual({ x: 30, y: 40, vx: 0, vy: 0 });
        const moved = new NodeLayoutCache("stemma-a");
        moved.load([600, 400]);
        expect(moved.get("n1")).toEqual({ x: 110, y: 20, vx: 0, vy: 0, ax: 200, ay: 200 });
    });

    test("retain prunes nodes that no longer exist (removed people do not linger)", () => {
        const cache = new NodeLayoutCache("stemma-1");
        cache.set("keep", 1, 1);
        cache.set("gone", 2, 2);
        cache.retain(["keep", "new"]);
        cache.save();
        const reloaded = new NodeLayoutCache("stemma-1");
        reloaded.load();
        expect(reloaded.has("keep")).toBe(true);
        expect(reloaded.has("gone")).toBe(false);
    });

    test("positions follow the layout centre when the viewport changed", () => {
        const cache = new NodeLayoutCache("stemma-1");
        cache.load([500, 400]);
        cache.set("n1", 510, 420);
        cache.save();

        const wider = new NodeLayoutCache("stemma-1");
        wider.load([700, 400]);
        expect(wider.get("n1")).toEqual({ x: 710, y: 420, vx: 0, vy: 0 });

        const legacy = new NodeLayoutCache("stemma-2");
        localStorage.setItem("nodeLayout.stemma-2", JSON.stringify({ items: { n1: { x: 1, y: 2 } } }));
        legacy.load([700, 400]);
        expect(legacy.get("n1")).toEqual({ x: 1, y: 2, vx: 0, vy: 0 });
    });
});
