import { pngExportSize } from "./pngExport";

describe("pngExportSize", () => {
    test("keeps a small chart at 2x for a crisp image", () => {
        expect(pngExportSize(800, 600)).toEqual({ width: 1600, height: 1200, scale: 2 });
    });

    test("caps the longest side", () => {
        const s = pngExportSize(40_000, 10_000);
        expect(s.width).toBe(8192);
        expect(s.height).toBe(2048);
        expect(s.scale).toBeCloseTo(8192 / 40_000);
    });

    test("caps the total area so browsers can allocate the canvas", () => {
        const s = pngExportSize(8000, 8000);
        expect(s.width * s.height).toBeLessThanOrEqual(40_000_000);
        expect(s.width).toBe(s.height);
    });

    test("never returns an empty canvas", () => {
        expect(pngExportSize(0, 0)).toEqual({ width: 1, height: 1, scale: 2 });
    });
});
