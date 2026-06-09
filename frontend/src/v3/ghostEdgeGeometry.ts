/**
 * Pure geometry helpers for positioning ghost edges.
 */

/**
 * Returns the point along the line from (x1,y1) to (x2,y2) that lies on the
 * circumference of a circle of radius `r` centered at (x2,y2).
 *
 * When the line is shorter than the radius the target center is returned
 * unchanged (degenerate case — avoids division by zero and sign flips).
 */
export function trimToCircle(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number,
): { x: number; y: number } {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= r) return { x: x2, y: y2 };
    const scale = (dist - r) / dist;
    return { x: x1 + dx * scale, y: y1 + dy * scale };
}

/** Visible gap (user-space px) between a ghost edge endpoint and the node circle it touches. */
export const GHOST_EDGE_GAP = 2;
