<script lang="ts">
    import * as d3 from "d3";
    import { t } from "../i18n";
    import {
        computeBounds,
        computeLayout,
        projectViewport,
        minimapClickToTranslate,
        projectAndBuildPaths,
        type NodeDot,
        type MinimapLayout,
    } from "../minimapProjection";

    type SimNode = { x?: number | null; y?: number | null; type?: string };
    type Sim = d3.Simulation<SimNode, undefined>;

    type Props = {
        editMode: boolean;
        stemmaChartReady: boolean;
        getSimulation: () => Sim | null;
        getZoomTransform: () => d3.ZoomTransform | null | undefined;
        applyZoomTranslate: (tx: number, ty: number) => void;
    };

    let {
        editMode,
        stemmaChartReady,
        getSimulation,
        getZoomTransform,
        applyZoomTranslate,
    }: Props = $props();

    const CANVAS_W = 160;
    const CANVAS_H = 120;
    const PERSON_R = 2.5;
    const FAMILY_R = 1.5;

    let visible = $state(true);
    let personsPath = $state("");
    let familiesPath = $state("");
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

    function readSimNodes(sim: Sim): NodeDot[] {
        const out: NodeDot[] = [];
        for (const n of sim.nodes()) {
            if ((n.type === "person" || n.type === "family") && n.x != null && n.y != null) {
                out.push({ x: n.x, y: n.y, type: n.type });
            }
        }
        return out;
    }

    export function refresh() {
        const sim = getSimulation();
        const raw = sim ? readSimNodes(sim) : [];
        const bounds = computeBounds(raw);
        layout = computeLayout(bounds, CANVAS_W, CANVAS_H);
        const paths = projectAndBuildPaths(raw, layout, PERSON_R, FAMILY_R);
        personsPath = paths.persons;
        familiesPath = paths.families;
        currentTransform = getZoomTransform() ?? d3.zoomIdentity;
    }

    $effect(() => {
        if (!editMode || !stemmaChartReady) return;

        viewWidth = window.innerWidth;
        viewHeight = window.innerHeight;

        let rafHandle = 0;
        const scheduleRefresh = () => {
            cancelAnimationFrame(rafHandle);
            rafHandle = requestAnimationFrame(refresh);
        };

        const sim = getSimulation();
        sim?.on("tick.minimap", scheduleRefresh);
        sim?.on("end.minimap", scheduleRefresh);

        const onResize = () => {
            viewWidth = window.innerWidth;
            viewHeight = window.innerHeight;
        };
        window.addEventListener("resize", onResize);

        scheduleRefresh();

        return () => {
            cancelAnimationFrame(rafHandle);
            sim?.on("tick.minimap", null);
            sim?.on("end.minimap", null);
            window.removeEventListener("resize", onResize);
        };
    });

    const projectedViewport = $derived(
        projectViewport(currentTransform, viewWidth, viewHeight, layout),
    );

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
    <div class="minimap-container" class:collapsed={!visible}>
        <button
            class="minimap-toggle"
            title={visible ? $t("minimap.hide") : $t("minimap.show")}
            aria-label={visible ? $t("minimap.hide") : $t("minimap.show")}
            onclick={() => (visible = !visible)}
        >
            {#if visible}
                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2 8a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8z" fill="currentColor"/>
                </svg>
            {:else}
                <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" fill="currentColor"/>
                </svg>
            {/if}
        </button>

        {#if visible}
            <svg
                class="minimap-canvas"
                width={CANVAS_W}
                height={CANVAS_H}
                role="img"
                aria-label={$t("minimap.show")}
                style="cursor: {isDragging ? 'grabbing' : 'crosshair'}"
                onpointerdown={onMinimapPointerDown}
                onpointermove={onMinimapPointerMove}
                onpointerup={onMinimapPointerUp}
            >
                <path d={personsPath} class="minimap-person" />
                <path d={familiesPath} class="minimap-family" />

                <rect
                    x={projectedViewport.x}
                    y={projectedViewport.y}
                    width={projectedViewport.width}
                    height={projectedViewport.height}
                    class="minimap-viewport"
                />
            </svg>
        {/if}
    </div>
{/if}

<style>
    .minimap-container {
        position: absolute;
        bottom: calc(216px + env(safe-area-inset-bottom, 0px));
        right: calc(20px + env(safe-area-inset-right, 0px));
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
            bottom: calc(192px + env(safe-area-inset-bottom, 0px));
        }
    }

    .minimap-container.collapsed {
        border-radius: 50%;
        width: 28px;
        height: 28px;
    }

    .minimap-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 6px;
        color: #495057;
        font-size: 10px;
        min-width: 28px;
        min-height: 20px;
        align-self: flex-end;
        line-height: 1;
    }

    .minimap-container.collapsed .minimap-toggle {
        width: 28px;
        height: 28px;
        padding: 0;
        align-self: auto;
    }

    .minimap-toggle:hover {
        color: #212529;
        background: rgba(0, 0, 0, 0.05);
    }

    .minimap-canvas {
        display: block;
        touch-action: none;
    }

    :global(.minimap-person) {
        fill: #5a7fa0;
        opacity: 0.7;
    }

    :global(.minimap-family) {
        fill: #326f93;
        opacity: 0.7;
    }

    :global(.minimap-viewport) {
        fill: rgba(100, 149, 237, 0.12);
        stroke: #4a80c4;
        stroke-width: 1.5px;
        pointer-events: none;
    }
</style>
