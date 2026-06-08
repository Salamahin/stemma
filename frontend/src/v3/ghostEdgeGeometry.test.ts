import { trimToCircle } from "./ghostEdgeGeometry";

describe("trimToCircle", () => {
    it("returns a point on the circle boundary along the given direction", () => {
        const result = trimToCircle(0, 0, 100, 0, 15);
        expect(result.x).toBeCloseTo(85, 5);
        expect(result.y).toBeCloseTo(0, 5);
    });

    it("works for diagonal lines", () => {
        const result = trimToCircle(0, 0, 30, 40, 5);
        // dist = 50, scale = 45/50 = 0.9
        expect(result.x).toBeCloseTo(27, 5);
        expect(result.y).toBeCloseTo(36, 5);
    });

    it("returns the target center when line length is less than radius", () => {
        const result = trimToCircle(0, 0, 3, 4, 10);
        expect(result).toEqual({ x: 3, y: 4 });
    });

    it("returns the target center when line length equals radius exactly", () => {
        const result = trimToCircle(0, 0, 5, 0, 5);
        expect(result).toEqual({ x: 5, y: 0 });
    });

    it("handles vertical lines", () => {
        const result = trimToCircle(0, 0, 0, 100, 20);
        expect(result.x).toBeCloseTo(0, 5);
        expect(result.y).toBeCloseTo(80, 5);
    });
});
