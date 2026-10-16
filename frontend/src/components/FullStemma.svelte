<script lang="ts">
    import * as d3 from "d3";
    import type { Stemma } from "../model";
    import { ViewMode } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { onMount } from "svelte";
    import { HighlightLineages } from "../highlight";
    import {
        assignInitialPositions,
        configureSimulation,
        resetSessionPositions,
        setActiveLayoutCache,
        setSessionPosition,
        makeNodesAndRelations,
        normalizeId,
        updateSimulation,
        denormalizeId,
        LAYOUT_REHEAT_ALPHA,
        LAYOUT_REFINE_ALPHA,
    } from "../graphTools";
    import { computeInitialLayout, seedFromKnown } from "../initialLayout";
    import { NodeLayoutCache } from "../nodeLayoutCache";
    import { PinnedPeopleStorage } from "../pinnedPeopleStorage";
    import { exportChartSvg } from "../svgExport";
    import { personDisplayName } from "../personDisplayName";
    import { t } from "../i18n";
    import { computeClans } from "../clans";
    import { CanvasChart, type ChartNode } from "../canvasChart";

    type Props = {
        stemma: Stemma;
        currentStemmaId: string;
        stemmaIndex: StemmaIndex;
        highlight: HighlightLineages;
        pinnedPeople: PinnedPeopleStorage;
        hidden: boolean;
        viewMode: ViewMode;
        simulationActive?: boolean;
        hoverHighlight?: boolean;
        onpersonSelected?: (person: any) => void;
        onfamilySelected?: (family: any) => void;
        onhighlightChanged?: () => void;
        onzoomChanged?: () => void;
        onchartReady?: (chart: CanvasChart | null) => void;
    };

    let {
        stemma,
        currentStemmaId,
        stemmaIndex,
        highlight,
        pinnedPeople,
        hidden,
        viewMode,
        simulationActive = true,
        hoverHighlight = true,
        onpersonSelected,
        onfamilySelected,
        onhighlightChanged,
        onzoomChanged,
        onchartReady,
    }: Props = $props();

    /** Clan clouds are re-rasterized at most this often while the sim moves nodes. */
    const CLAN_UPDATE_INTERVAL_MS = 100;

    let canvasEl: HTMLCanvasElement;
    let chart = $state<CanvasChart | null>(null);
    let isDragging = false;
    let layoutCache: NodeLayoutCache | null = null;
    let layoutCacheStemmaId: string | null = null;
    let simulation: any = null;
    let lastPointer: { x: number; y: number } | null = null;
    /** Node whose lineage the hover pushed onto the highlight stack. */
    let hoverPushedId: string | null = null;
    /** Layout timing, read by the e2e/bench scripts via window.__stemmaChart.layout(). */
    const layoutStats = { ticks: 0, lastTickAt: 0, lastEndAt: 0, ends: 0 };
    let lastSimulationActive: boolean | null = null;

    const viewSlice = $derived.by(() => {
        if (!stemma) return { people: [], families: [] };
        if (viewMode == ViewMode.EDITABLE_ONLY) {
            return {
                people: stemma.people.filter((p) => !p.readOnly),
                families: stemma.families.filter((f) => !f.readOnly),
            };
        }
        return { people: stemma.people, families: stemma.families };
    });

    $effect(() => {
        if (chart && stemma) {
            if (layoutCacheStemmaId !== currentStemmaId) {
                if (layoutCache) layoutCache.save();
                layoutCache = new NodeLayoutCache(currentStemmaId);
                layoutCache.load([window.innerWidth / 2, window.innerHeight / 2]);
                layoutCacheStemmaId = currentStemmaId;
            }
            setActiveLayoutCache(layoutCache);
            resetSessionPositions(currentStemmaId);

            const { people, families } = viewSlice;
            const displayPeople = people.map((p) => ({ ...p, name: personDisplayName(p.name, $t) }));
            const [nodes, relations] = makeNodesAndRelations(displayPeople, families);
            const initialPositions = computeInitialLayout(stemmaIndex, people, families, window.innerWidth, window.innerHeight);
            reconfigureGraph(chart, nodes, relations, initialPositions, computeClans({ type: "Stemma", people, families }));
        }
    });

    $effect(() => {
        if (highlight && pinnedPeople && stemmaIndex && chart) {
            renderFullStemma();
        }
    });

    function applyStyle() {
        chart?.setStyleInputs(highlight, stemmaIndex, pinnedPeople.allPinned());
    }

    /** Restyle + re-apply pins (pinned people are frozen at their position). */
    function renderFullStemma() {
        if (!chart) return;
        applyStyle();
        const pinned = new Set(pinnedPeople.allPinned());
        for (const d of chart.nodes) {
            d.fixed = false;
            if (d.type !== "person") continue;
            const personId = denormalizeId(d.id);
            if (!pinned.has(personId)) continue;
            d.fixed = true;
            d.fx = d.x;
            d.fy = d.y;
            if (!pinnedPeople.getPosition(personId)) pinnedPeople.updatePosition(personId, d.x, d.y);
        }
        for (const d of chart.nodes) {
            if (!d.fixed && simulationActive) {
                d.fx = null;
                d.fy = null;
            }
        }
        // Pinning only freezes nodes where they are; it does not need the
        // layout to run again (it used to restart a never-ending sim here).
    }

    const zoomHandler = d3
        .zoom<HTMLCanvasElement, unknown>()
        .on("zoom", (e) => {
            if (!chart) return;
            chart.transform = e.transform;
            chart.requestRender();
            onzoomChanged?.();
        });

    export function getChart(): CanvasChart | null {
        return chart;
    }

    export function exportSvg(filename: string) {
        if (!chart) return;
        exportChartSvg(chart.exportModel(), filename);
    }

    export function getZoomTransform(): d3.ZoomTransform {
        if (!canvasEl) return d3.zoomIdentity;
        return d3.zoomTransform(canvasEl);
    }

    export function applyZoomTranslate(tx: number, ty: number) {
        if (!canvasEl) return;
        const current = d3.zoomTransform(canvasEl);
        const next = d3.zoomIdentity.translate(tx, ty).scale(current.k);
        d3.select(canvasEl).call(zoomHandler.transform, next);
    }

    export function setSimulationActive(active: boolean) {
        if (!simulation) return;
        if (active) simulation.alphaTarget(0).alpha(Math.max(simulation.alpha(), LAYOUT_REHEAT_ALPHA)).restart();
        else simulation.alphaTarget(0).stop();
    }

    export function applyManualPositions() {
        if (!chart) return;
        chart.positionsChanged();
        chart.updateClans();
    }

    export function getSimulation(): any {
        return simulation;
    }

    $effect(() => {
        if (!simulation || !chart) return;
        const wasActive = lastSimulationActive;
        lastSimulationActive = simulationActive;
        if (simulationActive) {
            for (const d of chart.nodes) {
                if (!d.fixed) {
                    d.fx = null;
                    d.fy = null;
                }
            }
            // Leaving edit mode: let the freshly unpinned graph relax a little.
            // Nothing to do on first mount — the initial layout is already running.
            if (wasActive === false) simulation.alphaTarget(0).alpha(Math.max(simulation.alpha(), LAYOUT_REHEAT_ALPHA)).restart();
        } else {
            for (const d of chart.nodes) {
                if (d.x != null && d.y != null) {
                    d.fx = d.x;
                    d.fy = d.y;
                }
            }
            simulation.alphaTarget(0).stop();
        }
    });

    $effect(() => {
        if (!hoverHighlight) clearHover();
    });

    export function setNodePosition(nodeId: string, x: number, y: number) {
        setSessionPosition(nodeId, x, y);
    }

    export function popHover() {
        clearHover();
    }

    export function zoomToNode(id: string) {
        const scaleZoom = 2;
        const node = chart?.node(normalizeId("person", id));
        if (!node) return;
        d3.select(canvasEl)
            .transition()
            .duration(750)
            .call(
                zoomHandler.transform,
                d3.zoomIdentity
                    .translate(window.innerWidth * 0.5 - scaleZoom * node.x, window.innerHeight * 0.5 - scaleZoom * node.y)
                    .scale(scaleZoom),
            );
    }

    function hoverEnter(node: ChartNode) {
        if (!chart) return;
        if (node.type == "person") highlight.pushPerson(denormalizeId(node.id));
        else highlight.pushFamily(denormalizeId(node.id));
        hoverPushedId = node.id;
        chart.setHovered(node.id);
        applyStyle();
        onhighlightChanged?.();
    }

    function clearHover() {
        if (!chart || hoverPushedId === null) return;
        hoverPushedId = null;
        highlight.pop();
        chart.setHovered(null);
        applyStyle();
        onhighlightChanged?.();
    }

    function updateHover(clientX: number, clientY: number) {
        if (!chart || isDragging) return;
        if (document.body.classList.contains("linking")) return;
        if (!hoverHighlight) return;
        const hit = chart.hitNode(clientX, clientY);
        const hitId = hit?.id ?? null;
        if (hitId === hoverPushedId) return;
        clearHover();
        if (hit) hoverEnter(hit);
    }

    let lastClanUpdate = 0;
    function onSimTick() {
        layoutStats.ticks++;
        layoutStats.lastTickAt = performance.now();
        if (!chart) return;
        chart.positionsChanged();
        const now = performance.now();
        if (now - lastClanUpdate >= CLAN_UPDATE_INTERVAL_MS) {
            lastClanUpdate = now;
            chart.updateClans();
        }
    }

    function onSimEnd() {
        layoutStats.ends++;
        layoutStats.lastEndAt = performance.now();
        if (!chart) return;
        chart.layoutLabels();
        chart.updateClans();
    }

    /**
     * Below this share of nodes with a remembered position the stored layout
     * is not worth keeping: lay the stemma out from scratch instead.
     */
    const WARM_START_MIN_KNOWN = 0.5;

    function reconfigureGraph(chart: CanvasChart, nodes: any[], relations: any[], initialPositions: any, clans: any[]) {
        assignInitialPositions(nodes, window.innerWidth, window.innerHeight, initialPositions, pinnedPeople);

        // Reopened / edited stemma: nodes with a remembered position (pin,
        // stored layout, this session) keep it; new ones start next to their
        // relatives instead of on the generational grid, whose coordinates
        // have nothing to do with the remembered layout.
        const known = new Map<string, [number, number]>();
        for (const n of nodes) if (n.hadKnownPosition) known.set(n.id, [n.x, n.y]);
        const knownFrac = nodes.length ? known.size / nodes.length : 0;
        const warm = knownFrac >= WARM_START_MIN_KNOWN;
        if (warm && known.size < nodes.length) {
            const seeds = seedFromKnown(nodes, relations, known, initialPositions);
            for (const n of nodes) {
                const p = seeds.get(n.id);
                if (p && !n.hadKnownPosition) [n.x, n.y] = p;
            }
        }
        if (warm) {
            for (const n of nodes) {
                n.vx = 0;
                n.vy = 0;
            }
        }
        layoutCache?.retain(nodes.map((n) => n.id));

        if (!simulation) simulation = configureSimulation(nodes, relations, window.innerWidth, window.innerHeight, onSimTick, onSimEnd, () => simulationActive && !isDragging);
        else updateSimulation(simulation, nodes, relations);
        // Everything remembered: only a gentle refine. Mostly remembered: heat
        // proportional to the share of newcomers (they are already seeded next
        // to their relatives), so a few additions do not reshuffle the graph.
        // Otherwise: a full layout.
        simulation.alpha(warm ? Math.min(LAYOUT_REHEAT_ALPHA, LAYOUT_REFINE_ALPHA + (1 - knownFrac)) : 1);

        chart.setData(nodes, relations);
        chart.setClans(clans);
        applyStyle();
        if (knownFrac === 1) chart.layoutLabels();

        if (!simulationActive) {
            // Sim inactive (edit mode): pin every node that already had a known
            // position so the 80-tick settle only lays out genuinely new nodes,
            // leaving existing positions stable across data changes.
            for (const d of nodes) {
                if (d.hadKnownPosition && d.x != null && d.y != null) {
                    d.fx = d.x;
                    d.fy = d.y;
                }
            }
            simulation.tick(80);
            applyManualPositions();
            simulation.alphaTarget(0).stop();
        }
    }

    function setupInteractions(c: CanvasChart) {
        const selection = d3.select(canvasEl);

        // Node dragging (view mode). Registered before zoom: when the press
        // lands on a node, d3.drag claims it and the zoom never starts a pan.
        const drag = d3
            .drag<HTMLCanvasElement, unknown, any>()
            .container(canvasEl)
            .subject((event: any) => {
                const rect = canvasEl.getBoundingClientRect();
                const node = c.hitNode(event.x + rect.left, event.y + rect.top);
                if (!node) return null;
                const tr = c.transform;
                return { node, x: tr.applyX(node.x), y: tr.applyY(node.y) };
            })
            .on("start", (event: any) => {
                const node: ChartNode = event.subject.node;
                if (!event.active) simulation?.alphaTarget(0.3).restart();
                node.fx = node.x;
                node.fy = node.y;
                isDragging = true;
            })
            .on("drag", (event: any) => {
                const node: ChartNode = event.subject.node;
                node.fx = c.transform.invertX(event.x);
                node.fy = c.transform.invertY(event.y);
                // A settled sim has stopped; keep the dragged node following the pointer.
                simulation?.restart();
            })
            .on("end", (event: any) => {
                const node: ChartNode = event.subject.node;
                if (!event.active) simulation?.alphaTarget(0);
                if (!node.fixed) {
                    node.fx = null;
                    node.fy = null;
                }
                if (pinnedPeople && node.type === "person") {
                    const personId = denormalizeId(node.id);
                    if (pinnedPeople.isPinned(personId)) pinnedPeople.updatePosition(personId, node.x, node.y);
                }
                isDragging = false;
                if (lastPointer) updateHover(lastPointer.x, lastPointer.y);
            });

        selection.call(drag).call(zoomHandler);

        canvasEl.addEventListener("mousemove", (e) => {
            lastPointer = { x: e.clientX, y: e.clientY };
            updateHover(e.clientX, e.clientY);
            const ghost = c.hitGhost(e.clientX, e.clientY);
            c.setHoveredGhost(ghost?.id ?? null);
            const overNode = ghost || c.hitNode(e.clientX, e.clientY);
            canvasEl.style.cursor = overNode ? "pointer" : "";
        });
        canvasEl.addEventListener("mouseleave", () => {
            lastPointer = null;
            c.setHoveredGhost(null);
            if (isDragging) return;
            if (document.body.classList.contains("linking")) return;
            if (!hoverHighlight) return;
            clearHover();
        });
        canvasEl.addEventListener("click", (e) => {
            const node = c.hitNode(e.clientX, e.clientY);
            if (!node) return;
            if (node.type == "person") onpersonSelected?.(stemmaIndex.person(denormalizeId(node.id)));
            else onfamilySelected?.(stemmaIndex.family(denormalizeId(node.id)));
        });
    }

    onMount(() => {
        const c = new CanvasChart(canvasEl);
        setupInteractions(c);
        (window as any).__stemmaChart = {
            snapshot: () => c.snapshot(),
            layout: () => ({ ...layoutStats, firstDrawAt: c.firstDrawAt }),
        };
        chart = c;
        onchartReady?.(c);
        return () => {
            simulation?.stop();
            c.destroy();
            onchartReady?.(null);
            delete (window as any).__stemmaChart;
        };
    });
</script>

<div {hidden}>
    <canvas id="chart" class="chart-canvas" bind:this={canvasEl}></canvas>
</div>

<style lang="less">
    .chart-canvas {
        display: block;
        width: 100%;
        height: calc(~"100vh - 56px");
    }
</style>
