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
});
