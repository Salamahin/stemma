import { layoutGreedy, layoutRemoveOverlaps } from "d3fc-label-layout";
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

function oracle(rects: LabelRect[]) {
    const input = rects.map((r) => ({ ...r, hidden: false }));
    return layoutRemoveOverlaps(layoutGreedy())(input).map((r: any) => ({ x: r.x, y: r.y, hidden: !!r.hidden }));
}

describe("placeLabels (grid-indexed greedy + removeOverlaps)", () => {
    test.each([
        [50, 600, 400, 1],
        [200, 1500, 1200, 2],
        [300, 900, 700, 3], // dense: many overlaps, many hidden
        [400, 4000, 3000, 4],
    ])("matches d3fc-label-layout exactly for %i rects", (n, w, h, seed) => {
        const rects = randomRects(n, w, h, seed);
        expect(placeLabels(rects)).toEqual(oracle(rects));
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

    test("is fast on large inputs", () => {
        const rects = randomRects(3000, 20000, 18000, 9);
        const t0 = performance.now();
        placeLabels(rects);
        expect(performance.now() - t0).toBeLessThan(500);
    });
});
