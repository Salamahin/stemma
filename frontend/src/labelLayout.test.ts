import { placeLabels, type LabelRect } from "./labelLayout";

function lcg(seed: number) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

function randomRects(n: number, w: number, h: number, seed: number): LabelRect[] {
    const rnd = lcg(seed);
    return Array.from({ length: n }, () => ({
        x: Math.round(rnd() * w),
        y: Math.round(rnd() * h),
        width: 40 + Math.round(rnd() * 100),
        height: 22,
    }));
}

function overlap(a: LabelRect, b: LabelRect) {
    const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
}

function totalOverlap(labels: LabelRect[], placed: { x: number; y: number }[]) {
    const rects = labels.map((r, i) => ({ ...r, x: placed[i].x, y: placed[i].y }));
    let sum = 0;
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) sum += overlap(rects[i], rects[j]);
    return sum;
}

describe("placeLabels", () => {
    test("never hides a label, even in a dense cluster", () => {
        const rects = randomRects(300, 900, 700, 3);
        const placed = placeLabels(rects);
        expect(placed).toHaveLength(300);
        expect(placed.every((p) => !p.hidden)).toBe(true);
    });

    test("a parent label crowded by a fan of children stays visible and is moved clear", () => {
        // One parent label right on top of a child's label, as in a big family.
        const parent = { x: 0, y: 0, width: 200, height: 22 };
        const child = { x: 10, y: 4, width: 200, height: 22 };
        const placed = placeLabels([child, parent]);
        expect(placed[1].hidden).toBe(false);
        expect(totalOverlap([child, parent], placed)).toBe(0);
    });

    test("labels that do not collide keep their position", () => {
        const rects = [
            { x: 0, y: 0, width: 50, height: 20 },
            { x: 500, y: 500, width: 50, height: 20 },
        ];
        expect(placeLabels(rects)).toEqual([
            { x: 0, y: 0, hidden: false },
            { x: 500, y: 500, hidden: false },
        ]);
    });

    test("reduces overlap compared with the anchored positions", () => {
        const rects = randomRects(200, 1500, 1200, 2);
        const before = totalOverlap(rects, rects);
        const after = totalOverlap(rects, placeLabels(rects));
        expect(after).toBeLessThan(before * 0.3);
    });

    test("avoids covering obstacle circles when there is room", () => {
        const label = { x: 0, y: 0, width: 100, height: 20 };
        const placed = placeLabels([label], [{ x: 50, y: 10, r: 15 }]);
        const r = { ...label, x: placed[0].x, y: placed[0].y };
        expect(overlap(r, { x: 35, y: -5, width: 30, height: 30 })).toBe(0);
    });

    test("is fast on large inputs", () => {
        const rects = randomRects(3000, 20000, 18000, 9);
        const circles = rects.map((r) => ({ x: r.x + 10, y: r.y - 20, r: 15 }));
        const t0 = performance.now();
        placeLabels(rects, circles);
        expect(performance.now() - t0).toBeLessThan(500);
    });
});
