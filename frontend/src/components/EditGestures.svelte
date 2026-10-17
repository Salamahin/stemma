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
     * Relatives are added and linked through the ghosts (GhostLayer).
     */
    type Props = {
        editMode: boolean;
        panActive: boolean;
        panMode: boolean;
        chart: CanvasChart | null;
        popHover: () => void;
        onshortTapFocus: (f: FocusedId | null) => void;
        onlongPress: (f: FocusedId) => void;
        ondesktopNodeClick: (f: FocusedId) => void;
        onclearFocus: () => void;
        onnodeMoved: (nodeId: string, x: number, y: number) => void;
        onclosePanMode: () => void;
        onspacePanChange: (v: boolean) => void;
    };

    let {
        editMode,
        panActive,
        panMode,
        chart,
        popHover,
        onshortTapFocus,
        onlongPress,
        ondesktopNodeClick,
        onclearFocus,
        onnodeMoved,
        onclosePanMode,
        onspacePanChange,
    }: Props = $props();

    /** Pointer travel (px) before a press on a node becomes a move. */
    const MOVE_START_PX = 6;

    let moving = $state(false);

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
            press = null;
            moving = false;
            document.body.classList.remove("chart-gesture");
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
            if (panActive) return;
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
            };
            document.body.classList.add("chart-gesture");
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
                moving = true;
                cancelLongPress();
                // the ghosts belong to where the node was; they come back on drop
                onclearFocus();
            }
            const p = c.clientToWorld(e.clientX, e.clientY);
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
            if (press.moving) moveTo(press.node, press.from.x, press.from.y);
            endPress();
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            onCancel();
            onclearFocus();
        };

        // touchstart fires before pointerdown: on a node, swallow it so d3.zoom
        // does not start a pan in parallel and no synthetic mouse events or click
        // follow. Elsewhere it is a pan (or pinch) and passes through.
        const onTouchStartCapture = (e: TouchEvent) => {
            if (panActive || e.touches.length !== 1) return;
            const t = e.touches[0];
            if (!grabbable(t.clientX, t.clientY)) return;
            e.stopImmediatePropagation();
            e.preventDefault();
        };
        // d3.drag (view mode) and d3.zoom listen to mousedown: not on a node.
        const onMouseDownCapture = (e: MouseEvent) => {
            if (panActive || e.button !== 0) return;
            if (!grabbable(e.clientX, e.clientY)) return;
            e.stopImmediatePropagation();
        };
        // Clicks are handled here (pointerup), not by the chart's view-mode click
        // handler that opens the card.
        const onClickCapture = (e: MouseEvent) => {
            if (panActive) return;
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

    $effect(() => {
        if (!panActive) {
            document.body.classList.remove("pan-armed", "pan-dragging");
            return;
        }
        document.body.classList.add("pan-armed");
        const onDown = () => document.body.classList.add("pan-dragging");
        const onUp = () => document.body.classList.remove("pan-dragging");
        window.addEventListener("mousedown", onDown);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("mouseup", onUp);
            document.body.classList.remove("pan-armed", "pan-dragging");
        };
    });

    $effect(() => {
        if (!editMode) return;
        const isTypingTarget = (target: EventTarget | null): boolean => {
            if (!(target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (isTypingTarget(e.target)) return;
                if (panMode && !moving && !document.querySelector(".modal-panel")) {
                    onclosePanMode();
                }
                return;
            }
            if (e.code !== "Space" || e.repeat) return;
            if (isTypingTarget(e.target)) return;
            onspacePanChange(true);
            e.preventDefault();
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code !== "Space") return;
            onspacePanChange(false);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            onspacePanChange(false);
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

    :global(body.pan-armed),
    :global(body.pan-armed *) {
        cursor: grab !important;
    }

    :global(body.pan-dragging),
    :global(body.pan-dragging *) {
        cursor: grabbing !important;
    }
</style>
