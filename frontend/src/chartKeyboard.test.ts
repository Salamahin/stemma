import { nearestTo, nextInDirection, type Point } from "./chartKeyboard";

const grid: Point[] = [
    { id: "c", x: 0, y: 0 },
    { id: "r", x: 100, y: 5 },
    { id: "far-r", x: 300, y: 0 },
    { id: "l", x: -80, y: 0 },
    { id: "u", x: 0, y: -90 },
    { id: "d", x: 10, y: 120 },
    { id: "diag", x: 70, y: 70 },
];

describe("nextInDirection", () => {
    test.each([
        ["right", "r"],
        ["left", "l"],
        ["up", "u"],
        ["down", "d"],
    ] as const)("%s goes to the nearest node that way", (dir, expected) => {
        expect(nextInDirection(grid, "c", dir)?.id).toBe(expected);
    });

    test("prefers a node on the axis over a closer one far off it", () => {
        const pts: Point[] = [
            { id: "c", x: 0, y: 0 },
            { id: "offaxis", x: 40, y: 38 },
            { id: "onaxis", x: 60, y: 0 },
        ];
        expect(nextInDirection(pts, "c", "right")?.id).toBe("onaxis");
    });

    test("returns null at the edge", () => {
        expect(nextInDirection(grid, "far-r", "right")).toBeNull();
    });

    test("returns null for an unknown current node", () => {
        expect(nextInDirection(grid, "nope", "right")).toBeNull();
    });
});

describe("nearestTo", () => {
    test("picks the node closest to a point (the viewport centre)", () => {
        expect(nearestTo(grid, 90, 0)?.id).toBe("r");
        expect(nearestTo([], 0, 0)).toBeNull();
    });
});
