/**
 * Pure helpers for the focus state machine.
 *
 * Desktop: mousemove with distance-based hit detection (150 px radius in chart
 * user-space) -> focus; mouseleave from SVG -> debounced clear (150 ms).
 * Mobile: pointerdown starts a tap timer; pointerup within TAP_MAX_MS and
 * TAP_MAX_MOVE_PX -> short-tap -> focus. Movement or timeout = drag, no focus.
 */

export type NodeKind = "person" | "family";

export type FocusedId = { kind: NodeKind; id: string };

export const MOUSE_LEAVE_DEBOUNCE_MS = 150;
export const TAP_MAX_MS = 500;
export const TAP_MAX_MOVE_PX = 10;
export const FOCUS_RADIUS_SVG = 150;
/**
 * Sticky radius for an already-focused node. The acquire boundary is
 * FOCUS_RADIUS_SVG; once focus is acquired we hold it until the cursor leaves
 * this larger radius. Hysteresis prevents focus from flickering on/off when
 * the cursor sits right at the acquire boundary.
 */
export const FOCUS_RADIUS_STICKY_SVG = 220;

/**
 * Hit radius for the "cursor still near a ghost" check that keeps the focused
 * node from blurring while the user is moving toward a ghost. Larger than the
 * ghost circle radius so the dashed circle plus its label sit inside the zone
 * and small cursor jitters between ghosts don't drop the focus.
 */
export const GHOST_HOVER_RADIUS_SVG = 60;

/**
 * Returns true when the cursor position is within `hitRadius` SVG user-space
 * units of any ghost position.
 *
 * Using the ghost's rendered node radius as `hitRadius` ensures the focus zone
 * exactly covers the ghost's visual circle and closes the traversal gap between
 * the real-node focus radius and the ghost seed distance.
 */
export function cursorNearGhost(
    positions: ReadonlyArray<{ x: number; y: number }>,
    cursorSvgX: number,
    cursorSvgY: number,
    hitRadius: number,
): boolean {
    return positions.some((p) => Math.hypot(p.x - cursorSvgX, p.y - cursorSvgY) <= hitRadius);
}

/**
 * Returns true when a pointerup event qualifies as a short tap (no drag, no
 * long press). All inputs are the raw numbers so this function is pure and
 * trivially testable.
 */
export function isShortTap(
    elapsedMs: number,
    movedPx: number,
): boolean {
    return elapsedMs < TAP_MAX_MS && movedPx <= TAP_MAX_MOVE_PX;
}

/**
 * Returns true when a timer-fired event qualifies as a long press (pointer
 * held down for at least TAP_MAX_MS with minimal movement). All inputs are the
 * raw numbers so this function is pure and trivially testable.
 */
export function isLongPress(
    elapsedMs: number,
    movedPx: number,
): boolean {
    return elapsedMs >= TAP_MAX_MS && movedPx <= TAP_MAX_MOVE_PX;
}

/**
 * Finds the nearest ancestor `<g>` element whose id starts with "person_" or
 * "family_", starting from `target`. Returns null when no such ancestor exists.
 */
export function closestNodeG(target: EventTarget | null): SVGGElement | null {
    const el = target as Element | null;
    return (el?.closest?.("g[id^='person_'], g[id^='family_']") as SVGGElement | null) ?? null;
}

/**
 * Derives a FocusedId from a chart node id ("person_<id>" / "family_<id>"),
 * or returns null if it is a pending node (which should not receive focus).
 */
export function focusedIdFromNodeId(
    nodeId: string,
    isPendingId: (id: string) => boolean,
): FocusedId | null {
    const kind: NodeKind = nodeId.startsWith("person_") ? "person" : "family";
    const id = nodeId.split("_")[1];
    if (isPendingId(id)) return null;
    return { kind, id };
}

/**
 * Derives a FocusedId from a DOM `<g>` element whose id follows the chart
 * node-id scheme, or returns null if the element is a pending node.
 */
export function focusedIdFromG(
    g: SVGGElement,
    isPendingId: (id: string) => boolean,
): FocusedId | null {
    return focusedIdFromNodeId(g.id, isPendingId);
}

export type PositionedNode = { id: string; x?: number | null; y?: number | null };

/**
 * Finds the nearest real (non-pending) person or family node whose center is
 * within `acquireRadius` user-space units of `(cursorX, cursorY)`.
 *
 * `nodes` are the chart's real-node datums (ids starting with "person_" or
 * "family_", positions as populated by d3-force).
 *
 * Hysteresis: if `currentFocus` is supplied and the cursor is still within
 * `stickyRadius` of that node, focus is held even when no other node is in
 * the acquire range. Entering another node's acquire range switches focus
 * to the closer node.
 *
 * Returns null when no node is within range and no sticky candidate exists.
 */
export function nearestNodeWithinRadius(
    nodes: Iterable<PositionedNode>,
    cursorX: number,
    cursorY: number,
    acquireRadius: number,
    isPendingId: (id: string) => boolean,
    currentFocus: FocusedId | null = null,
    stickyRadius: number = acquireRadius,
): FocusedId | null {
    let bestInAcquire: FocusedId | null = null;
    let bestDist = acquireRadius;
    let currentDist = Infinity;

    for (const datum of nodes) {
        if (!datum.id.startsWith("person_") && !datum.id.startsWith("family_")) continue;
        if (datum.x == null || datum.y == null) continue;
        const focused = focusedIdFromNodeId(datum.id, isPendingId);
        if (!focused) continue;
        const dist = Math.hypot(datum.x - cursorX, datum.y - cursorY);
        if (dist <= bestDist) {
            bestDist = dist;
            bestInAcquire = focused;
        }
        if (currentFocus && focused.id === currentFocus.id && focused.kind === currentFocus.kind) {
            currentDist = dist;
        }
    }

    if (bestInAcquire) return bestInAcquire;
    if (currentFocus && currentDist <= stickyRadius) return currentFocus;
    return null;
}
