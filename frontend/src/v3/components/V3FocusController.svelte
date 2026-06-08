<script lang="ts">
    import {
        FOCUS_RADIUS_SVG,
        MOUSE_LEAVE_DEBOUNCE_MS,
        nearestNodeWithinRadius,
        type FocusedId,
    } from "../focusGesture";
    import { isPendingId } from "../pendingState";
    import { clientToSvgPoint } from "../v3DomGeometry";


    type Props = {
        editMode: boolean;
        stemmaChartReady: boolean;
        ghostSimPositions: Array<{ x: number; y: number }>;
        focusedId: FocusedId | null;
        onfocusChange: (f: FocusedId | null) => void;
    };

    let { editMode, stemmaChartReady, ghostSimPositions, focusedId, onfocusChange }: Props = $props();

    // Desktop mouse focus (edit mode only): distance-based hit detection on
    // mousemove. Uses each real-node datum's (x, y) from the d3 simulation
    // and focuses the nearest node within FOCUS_RADIUS_SVG user-space units.
    $effect(() => {
        if (!editMode || !stemmaChartReady) return;
        const svgEl = document.getElementById("chart");
        if (!svgEl) return;

        let leaveTimer: ReturnType<typeof setTimeout> | null = null;

        const cancelLeave = () => {
            if (leaveTimer !== null) {
                clearTimeout(leaveTimer);
                leaveTimer = null;
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (e.buttons !== 0) return;
            const mainG = svgEl.querySelector("g.main") as SVGGElement | null;
            if (!mainG) return;
            const svgPt = clientToSvgPoint(svgEl as unknown as SVGSVGElement, e.clientX, e.clientY);
            const next = nearestNodeWithinRadius(mainG, svgPt.x, svgPt.y, FOCUS_RADIUS_SVG, isPendingId);
            if (!next) {
                const nearGhost = ghostSimPositions.some(
                    (p) => Math.hypot(p.x - svgPt.x, p.y - svgPt.y) <= FOCUS_RADIUS_SVG,
                );
                if (nearGhost) {
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
            leaveTimer = setTimeout(() => {
                leaveTimer = null;
                onfocusChange(null);
            }, MOUSE_LEAVE_DEBOUNCE_MS);
        };

        svgEl.addEventListener("mousemove", onMouseMove);
        svgEl.addEventListener("mouseleave", onMouseLeave);
        return () => {
            cancelLeave();
            svgEl.removeEventListener("mousemove", onMouseMove);
            svgEl.removeEventListener("mouseleave", onMouseLeave);
        };
    });
</script>
