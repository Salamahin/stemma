/** Keyboard navigation between chart nodes: arrows move to the nearest node in that direction. */
export type Point = { id: string; x: number; y: number };
export type Direction = "left" | "right" | "up" | "down";

const AXIS: Record<Direction, [number, number]> = {
    left: [-1, 0],
    right: [1, 0],
    up: [0, -1],
    down: [0, 1],
};

/** Nearest node within a 45° cone in `dir`; distance off the axis counts double. */
export function nextInDirection(points: ReadonlyArray<Point>, currentId: string, dir: Direction): Point | null {
    const current = points.find((p) => p.id === currentId);
    if (!current) return null;
    const [ax, ay] = AXIS[dir];
    let best: Point | null = null;
    let bestScore = Infinity;
    for (const p of points) {
        if (p.id === currentId) continue;
        const dx = p.x - current.x;
        const dy = p.y - current.y;
        const along = dx * ax + dy * ay;
        const across = Math.abs(dx * ay - dy * ax);
        if (along <= 0 || across > along) continue;
        const score = along + 2 * across;
        if (score < bestScore) {
            bestScore = score;
            best = p;
        }
    }
    return best;
}

export function nearestTo(points: ReadonlyArray<Point>, x: number, y: number): Point | null {
    let best: Point | null = null;
    let bestD = Infinity;
    for (const p of points) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestD) {
            bestD = d;
            best = p;
        }
    }
    return best;
}
