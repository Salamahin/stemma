<script lang="ts">
    import {
        FOCUS_RADIUS_SVG,
        FOCUS_RADIUS_STICKY_SVG,
        GHOST_HOVER_RADIUS_SVG,
        MOUSE_LEAVE_DEBOUNCE_MS,
        nearestNodeWithinRadius,
        cursorNearGhost,
        type FocusedId,
    } from "../focusGesture";
    import { isPendingId } from "../pendingState";
    import type { CanvasChart } from "../canvasChart";


    type Props = {
        editMode: boolean;
        chart: CanvasChart | null;
        ghostSimPositions: Array<{ x: number; y: number }>;
        focusedId: FocusedId | null;
        onfocusChange: (f: FocusedId | null) => void;
    };

    let { editMode, chart, ghostSimPositions, focusedId, onfocusChange }: Props = $props();

    // Desktop mouse focus (edit mode only): distance-based hit detection on
    // mousemove. Uses each real-node datum's (x, y) from the d3 simulation
    // and focuses the nearest node within FOCUS_RADIUS_SVG user-space units.
    $effect(() => {
        if (!editMode || !chart) return;
        const c = chart;
        const canvasEl = c.canvas;

        let leaveTimer: ReturnType<typeof setTimeout> | null = null;

        const cancelLeave = () => {
            if (leaveTimer !== null) {
                clearTimeout(leaveTimer);
                leaveTimer = null;
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (e.buttons !== 0) return;
            const pt = c.clientToWorld(e.clientX, e.clientY);
            const next = nearestNodeWithinRadius(
                c.nodes,
                pt.x,
                pt.y,
                FOCUS_RADIUS_SVG,
                isPendingId,
                focusedId,
                FOCUS_RADIUS_STICKY_SVG,
            );
            if (!next) {
                if (cursorNearGhost(ghostSimPositions, pt.x, pt.y, GHOST_HOVER_RADIUS_SVG)) {
                    cancelLeave();
                    return;
                }
                if (focusedId !== null && leaveTimer === null) {
                    leaveTimer = setTimeout(() => {
                        leaveTimer = null;
                        onfocusChange(null);
                    }, MOUSE_LEAVE_DEBOUNCE_MS);
                }
                return;
            }
            cancelLeave();
            if (focusedId?.id !== next.id || focusedId?.kind !== next.kind) {
                onfocusChange(next);
            }
        };

        const onMouseLeave = (_e: MouseEvent) => {
            cancelLeave();
            if (focusedId === null) return;
            leaveTimer = setTimeout(() => {
                leaveTimer = null;
                if (focusedId !== null) onfocusChange(null);
            }, MOUSE_LEAVE_DEBOUNCE_MS);
        };

        canvasEl.addEventListener("mousemove", onMouseMove);
        canvasEl.addEventListener("mouseleave", onMouseLeave);
        return () => {
            cancelLeave();
            canvasEl.removeEventListener("mousemove", onMouseMove);
            canvasEl.removeEventListener("mouseleave", onMouseLeave);
        };
    });
</script>
