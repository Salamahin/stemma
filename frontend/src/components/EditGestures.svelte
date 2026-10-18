<script lang="ts">
    import { focusedIdFromNodeId, isShortTap, TAP_MAX_MS, TAP_MAX_MOVE_PX, type FocusedId } from "../focusGesture";
    import { isPendingId, isPendingPersonId } from "../pendingState";
    import { denormalizeId } from "../graphTools";
    import type { CanvasChart, ChartNode } from "../canvasChart";

    /**
     * Edit-mode pointer gestures on the chart canvas:
     * - drag a person or family: move it (it stays there; see FullStemma.placeNode)
     * - long press (any pointer): open the person's card
     * - short tap (touch): focus — the ghost affordances appear; tap on empty canvas blurs
     * - click (mouse): open the card (hover focuses)
     * - drag on empty canvas: pan, as in view mode
     * In link mode a drag from one person onto another links them instead
     * (`onlinkDrop` offers the valid links, see ghostLink.linkOptions).
     * Relatives are added through the ghosts (GhostLayer).
     */
    type Props = {
        editMode: boolean;
        linkMode: boolean;
        chart: CanvasChart | null;
        /** Whether dropping `fromId` onto `toId` (chart ids) can link them at all. */
        canLink: (fromId: string, toId: string) => boolean;
        popHover: () => void;
        onshortTapFocus: (f: FocusedId | null) => void;
        onlongPress: (f: FocusedId) => void;
        ondesktopNodeClick: (f: FocusedId) => void;
        onclearFocus: () => void;
        onnodeMoved: (nodeId: string, x: number, y: number) => void;
        onlinkDrop: (fromId: string, toId: string, clientX: number, clientY: number) => void;
        onexitLinkMode: () => void;
    };

    let {
        editMode,
        linkMode,
        chart,
        canLink,
        popHover,
        onshortTapFocus,
        onlongPress,
        ondesktopNodeClick,
        onclearFocus,
        onnodeMoved,
        onlinkDrop,
        onexitLinkMode,
    }: Props = $props();

    /** Pointer travel (px) before a press on a node becomes a move. */
    const MOVE_START_PX = 6;

    $effect(() => {
        if (!editMode || !chart) return;
        const c = chart;
        const canvasEl = c.canvas;

        /** A press on a node: may become a tap, a long press or a move. */
        let press: {
            node: ChartNode;
            pointerType: string;
            startClientX: number;
            startClientY: number;
            startMs: number;
            /** pointer − node centre, in world units, so the node does not jump under the pointer */
            grabDx: number;
            grabDy: number;
            from: { x: number; y: number };
            moving: boolean;
            longPressed: boolean;
            /** link mode: a drag draws a line to another person instead of moving */
            linking: boolean;
            linkTarget: ChartNode | null;
        } | null = null;
        /** A touch press on empty canvas (pans; a short one blurs). */
        let emptyPress: { x: number; y: number; startMs: number } | null = null;
        let longPressTimer: ReturnType<typeof setTimeout> | null = null;

        const cancelLongPress = () => {
            if (longPressTimer !== null) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        const grabbable = (clientX: number, clientY: number): ChartNode | null => {
            if (c.hitGhost(clientX, clientY)) return null;
            const node = c.hitNode(clientX, clientY);
            if (!node) return null;
            if (node.type === "person" && isPendingPersonId(denormalizeId(node.id))) return null;
            return node;
        };

        const endPress = () => {
            cancelLongPress();
            if (press?.linking) {
                c.setOverlay({ line: null, sourceMarker: null, preview: null });
                c.setDropTarget(null);
                c.setGestureSource(null);
            }
            press = null;
            document.body.classList.remove("chart-gesture", "chart-linking");
        };

        const moveTo = (node: ChartNode, x: number, y: number) => {
            node.x = x;
            node.y = y;
            // edit mode keeps every node pinned where it stands
            if (node.fx != null) node.fx = x;
            if (node.fy != null) node.fy = y;
            c.positionsChanged();
        };

        const onPointerDownCapture = (e: PointerEvent) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            const node = grabbable(e.clientX, e.clientY);
            if (!node) {
                if (e.pointerType !== "mouse") emptyPress = { x: e.clientX, y: e.clientY, startMs: Date.now() };
                return; // empty canvas: d3.zoom pans
            }
            // the press is ours: neither the view-mode d3.drag nor the zoom may start
            e.stopImmediatePropagation();
            e.preventDefault();
            popHover();
            const p = c.clientToWorld(e.clientX, e.clientY);
            press = {
                node,
                pointerType: e.pointerType,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startMs: Date.now(),
                grabDx: p.x - node.x,
                grabDy: p.y - node.y,
                from: { x: node.x, y: node.y },
                moving: false,
                longPressed: false,
                linking: linkMode && node.type === "person",
                linkTarget: null,
            };
            document.body.classList.add(press.linking ? "chart-linking" : "chart-gesture");
            const nodeId = node.id;
            longPressTimer = setTimeout(() => {
                longPressTimer = null;
                if (!press || press.moving) return;
                const focused = focusedIdFromNodeId(nodeId, isPendingId);
                if (!focused) return;
                press.longPressed = true;
                onlongPress(focused);
            }, TAP_MAX_MS);
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!press) return;
            const travelled = Math.hypot(e.clientX - press.startClientX, e.clientY - press.startClientY);
            if (!press.moving) {
                if (press.longPressed || travelled <= MOVE_START_PX) return;
                press.moving = true;
                cancelLongPress();
                // the ghosts belong to where the node was; they come back on drop
                onclearFocus();
                if (press.linking) c.setGestureSource(press.node.id);
            }
            const p = c.clientToWorld(e.clientX, e.clientY);
            if (press.linking) {
                const over = c.hitNode(e.clientX, e.clientY);
                const target = over && over.type === "person" && over !== press.node && canLink(press.node.id, over.id) ? over : null;
                if (target !== press.linkTarget) {
                    press.linkTarget = target;
                    c.setDropTarget(target?.id ?? null);
                }
                const end = target ? { x: target.x, y: target.y } : p;
                c.setOverlay({ line: { x1: press.node.x, y1: press.node.y, x2: end.x, y2: end.y }, sourceMarker: null, preview: null });
                return;
            }
            moveTo(press.node, p.x - press.grabDx, p.y - press.grabDy);
        };

        const onPointerUp = (e: PointerEvent) => {
            if (emptyPress && !press) {
                const elapsed = Date.now() - emptyPress.startMs;
                const travelled = Math.hypot(e.clientX - emptyPress.x, e.clientY - emptyPress.y);
                emptyPress = null;
                if (isShortTap(elapsed, travelled)) onshortTapFocus(null);
                return;
            }
            if (!press) return;
            const p = press;
            endPress();
            const focused = focusedIdFromNodeId(p.node.id, isPendingId);
            if (p.moving && p.linking) {
                if (p.linkTarget) onlinkDrop(p.node.id, p.linkTarget.id, e.clientX, e.clientY);
                return;
            }
            if (p.moving) {
                onnodeMoved(p.node.id, p.node.x, p.node.y);
                // show the ghosts where the node now is
                if (focused) onshortTapFocus(focused);
                return;
            }
            if (p.longPressed || !focused) return;
            const elapsed = Date.now() - p.startMs;
            const travelled = Math.hypot(e.clientX - p.startClientX, e.clientY - p.startClientY);
            if (p.pointerType !== "mouse") {
                if (isShortTap(elapsed, travelled)) onshortTapFocus(focused);
                return;
            }
            ondesktopNodeClick(focused);
        };

        const onCancel = () => {
            emptyPress = null;
            if (!press) return;
            // an interrupted move puts the node back
            if (press.moving && !press.linking) moveTo(press.node, press.from.x, press.from.y);
            endPress();
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (document.querySelector(".modal-panel, .link-picker")) return;
            const busy = press != null;
            onCancel();
            onclearFocus();
            if (!busy && linkMode) onexitLinkMode();
        };

        // touchstart fires before pointerdown: on a node, swallow it so d3.zoom
        // does not start a pan in parallel and no synthetic mouse events or click
        // follow. Elsewhere it is a pan (or pinch) and passes through.
        const onTouchStartCapture = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            if (!grabbable(t.clientX, t.clientY)) return;
            e.stopImmediatePropagation();
            e.preventDefault();
        };
        // d3.drag (view mode) and d3.zoom listen to mousedown: not on a node.
        const onMouseDownCapture = (e: MouseEvent) => {
            if (e.button !== 0) return;
            if (!grabbable(e.clientX, e.clientY)) return;
            e.stopImmediatePropagation();
        };
        // Clicks are handled here (pointerup), not by the chart's view-mode click
        // handler that opens the card.
        const onClickCapture = (e: MouseEvent) => {
            e.stopImmediatePropagation();
        };

        canvasEl.addEventListener("pointerdown", onPointerDownCapture, true);
        canvasEl.addEventListener("touchstart", onTouchStartCapture, true);
        canvasEl.addEventListener("mousedown", onMouseDownCapture, true);
        canvasEl.addEventListener("click", onClickCapture, true);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("contextmenu", onCancel);
        window.addEventListener("blur", onCancel);
        return () => {
            canvasEl.removeEventListener("pointerdown", onPointerDownCapture, true);
            canvasEl.removeEventListener("touchstart", onTouchStartCapture, true);
            canvasEl.removeEventListener("mousedown", onMouseDownCapture, true);
            canvasEl.removeEventListener("click", onClickCapture, true);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onCancel);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("contextmenu", onCancel);
            window.removeEventListener("blur", onCancel);
            onCancel();
        };
    });

</script>

<style>
    :global(body.chart-gesture),
    :global(body.chart-gesture *) {
        cursor: grabbing !important;
        user-select: none !important;
        -webkit-user-select: none !important;
    }

    :global(body.chart-linking),
    :global(body.chart-linking *) {
        cursor: crosshair !important;
        user-select: none !important;
        -webkit-user-select: none !important;
    }
</style>
