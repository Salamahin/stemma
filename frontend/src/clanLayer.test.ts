import { clanShape } from "./clanLayer";

describe("clanShape", () => {
    test("empty positions returns minimum-sized shape at origin", () => {
        const s = clanShape([]);
        expect(s.cx).toBe(0);
        expect(s.cy).toBe(0);
        expect(s.rx).toBeGreaterThan(0);
        expect(s.ry).toBeGreaterThan(0);
        expect(s.angle).toBe(0);
    });

    test("centroid is mean of positions", () => {
        const s = clanShape([[0, 0], [100, 0], [0, 100], [100, 100]]);
        expect(s.cx).toBeCloseTo(50, 5);
        expect(s.cy).toBeCloseTo(50, 5);
    });

    test("horizontal line of points yields ~0 rotation", () => {
        const s = clanShape([[-100, 0], [0, 0], [100, 0]]);
        const deg = (s.angle * 180) / Math.PI;
        expect(Math.abs(deg % 180)).toBeLessThan(1);
    });

    test("vertical line of points yields ~±90° rotation (major axis vertical)", () => {
        const s = clanShape([[0, -100], [0, 0], [0, 100]]);
        const deg = Math.abs((s.angle * 180) / Math.PI);
        const folded = Math.min(Math.abs(deg - 90), Math.abs(deg + 90));
        expect(folded).toBeLessThan(1);
    });

    test("rx >= ry (major axis convention)", () => {
        const s = clanShape([[-200, 0], [200, 0], [0, 10], [0, -10]]);
        expect(s.rx).toBeGreaterThanOrEqual(s.ry);
    });
});
