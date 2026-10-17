<script lang="ts">
    import * as d3 from "d3";
    import { t } from "../i18n";
    import type { CanvasChart } from "../canvasChart";
    import {
        computeBounds,
        computeLayout,
        projectViewport,
        minimapClickToTranslate,
        drawMinimap,
        type NodeDot,
        type MinimapLayout,
    } from "../minimapProjection";

    type Props = {
        editMode: boolean;
        chart: CanvasChart | null;
        getZoomTransform: () => d3.ZoomTransform | null | undefined;
        applyZoomTranslate: (tx: number, ty: number) => void;
    };

    let {
        editMode,
        chart,
        getZoomTransform,
        applyZoomTranslate,
    }: Props = $props();

    const CANVAS_W = 160;
    const CANVAS_H = 120;
    const STYLE = {
        person: "#5a7fa0",
        family: "#326f93",
        viewportFill: "rgba(100, 149, 237, 0.12)",
        viewportStroke: "#4a80c4",
    };

    let canvasEl = $state<HTMLCanvasElement | null>(null);
    let nodes: NodeDot[] = [];
    let nodesVersion = $state(0);
    let currentTransform = $state<d3.ZoomTransform>(d3.zoomIdentity);
    let isDragging = $state(false);
    let viewWidth = $state(typeof window !== "undefined" ? window.innerWidth : 0);
    let viewHeight = $state(typeof window !== "undefined" ? window.innerHeight : 0);
    let layout = $state<MinimapLayout>({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        contentWidth: 0,
        contentHeight: 0,
    });

    function readChartNodes(c: CanvasChart): NodeDot[] {
        const out: NodeDot[] = [];
        for (const n of c.nodes) {
            if ((n.type === "person" || n.type === "family") && n.x != null && n.y != null) {
                out.push({ x: n.x, y: n.y, type: n.type });
            }
        }
        return out;
    }

    export function refresh() {
        nodes = chart ? readChartNodes(chart) : [];
        layout = computeLayout(computeBounds(nodes), CANVAS_W, CANVAS_H);
        nodesVersion++;
        currentTransform = getZoomTransform() ?? d3.zoomIdentity;
    }

    $effect(() => {
        if (!editMode || !chart) return;

        viewWidth = window.innerWidth;
        viewHeight = window.innerHeight;

        let rafHandle = 0;
        const scheduleRefresh = () => {
            cancelAnimationFrame(rafHandle);
            rafHandle = requestAnimationFrame(refresh);
        };

        const unsubscribe = chart.onPositionsChanged(scheduleRefresh);

        const onResize = () => {
            viewWidth = window.innerWidth;
            viewHeight = window.innerHeight;
        };
        window.addEventListener("resize", onResize);

        scheduleRefresh();

        return () => {
            cancelAnimationFrame(rafHandle);
            unsubscribe();
            window.removeEventListener("resize", onResize);
        };
    });

    const projectedViewport = $derived(
        projectViewport(currentTransform, viewWidth, viewHeight, layout),
    );

    // Redraw whenever the nodes or the viewport frame change.
    $effect(() => {
        nodesVersion;
        const viewport = projectedViewport;
        const canvas = canvasEl;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== CANVAS_W * dpr || canvas.height !== CANVAS_H * dpr) {
            canvas.width = CANVAS_W * dpr;
            canvas.height = CANVAS_H * dpr;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        drawMinimap(ctx, nodes, layout, viewport, { width: CANVAS_W, height: CANVAS_H, dpr }, STYLE);
    });

    function onMinimapPointerDown(event: PointerEvent) {
        event.preventDefault();
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
        isDragging = true;
        panToPointer(event.offsetX, event.offsetY);
    }

    function onMinimapPointerMove(event: PointerEvent) {
        if (!isDragging) return;
        panToPointer(event.offsetX, event.offsetY);
    }

    function onMinimapPointerUp(event: PointerEvent) {
        isDragging = false;
        (event.currentTarget as Element).releasePointerCapture(event.pointerId);
    }

    function panToPointer(clickX: number, clickY: number) {
        const [tx, ty] = minimapClickToTranslate(
            clickX,
            clickY,
            layout,
            currentTransform,
            viewWidth,
            viewHeight,
        );
        applyZoomTranslate(tx, ty);
        currentTransform = getZoomTransform() ?? d3.zoomIdentity;
    }
</script>

{#if editMode}
    <div class="minimap-container">
        <canvas
            bind:this={canvasEl}
            class="minimap-canvas"
            style="width: {CANVAS_W}px; height: {CANVAS_H}px; cursor: {isDragging ? 'grabbing' : 'crosshair'}"
            aria-label={$t("minimap.show")}
            data-testid="minimap"
            onpointerdown={onMinimapPointerDown}
            onpointermove={onMinimapPointerMove}
            onpointerup={onMinimapPointerUp}
        ></canvas>
    </div>
{/if}

<style>
    .minimap-container {
        position: absolute;
        bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        right: calc(96px + env(safe-area-inset-right, 0px));
        z-index: 100;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        user-select: none;
    }

    @media (max-width: 767.98px) {
        .minimap-container {
            display: none;
        }
    }

    .minimap-canvas {
        display: block;
        touch-action: none;
    }

</style>
