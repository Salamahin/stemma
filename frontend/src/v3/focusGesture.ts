/**
 * Pure helpers for the v3 focus state machine.
 *
 * Desktop: mousemove with distance-based hit detection (150 px radius in SVG
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
 * Derives a FocusedId from a DOM `<g>` element produced by the chart, or
 * returns null if the element is a pending node (which should not receive focus).
 */
export function focusedIdFromG(
    g: SVGGElement,
    isPendingId: (id: string) => boolean,
): FocusedId | null {
    const kind: NodeKind = g.id.startsWith("person_") ? "person" : "family";
    const id = g.id.split("_")[1];
    if (isPendingId(id)) return null;
    return { kind, id };
}

/**
 * Finds the nearest real (non-pending) person or family node whose center is
 * within `radiusSvg` SVG user-space units of `(cursorSvgX, cursorSvgY)`.
 *
 * Each candidate <g> element must carry a d3 datum with `x` and `y` fields
 * (the same format d3-force populates).  Real node <g> elements have ids
 * starting with "person_" or "family_".
 *
 * Returns null when no node is within range.
 */
export function nearestNodeWithinRadius(
    mainG: SVGGElement,
    cursorSvgX: number,
    cursorSvgY: number,
    radiusSvg: number,
    isPendingId: (id: string) => boolean,
): FocusedId | null {
    let best: FocusedId | null = null;
    let bestDist = radiusSvg;

    const candidates = mainG.querySelectorAll<SVGGElement>("g[id^='person_'], g[id^='family_']");
    for (const g of candidates) {
        const datum = (g as SVGGElement & { __data__?: { x?: number; y?: number } }).__data__;
        if (!datum || datum.x == null || datum.y == null) continue;
        const dist = Math.hypot(datum.x - cursorSvgX, datum.y - cursorSvgY);
        if (dist <= bestDist) {
            const focused = focusedIdFromG(g, isPendingId);
            if (focused) {
                bestDist = dist;
                best = focused;
            }
        }
    }

    return best;
}
