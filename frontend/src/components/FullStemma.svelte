<script lang="ts">
    import * as d3 from "d3";
    import type { Stemma } from "../model";
    import { ViewMode } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { onMount, untrack } from "svelte";
    import { HighlightLineages, effectiveHighlight } from "../highlight";
    import {
        assignInitialPositions,
        resetSessionPositions,
        setActiveLayoutCache,
        setSessionPosition,
        makeNodesAndRelations,
        normalizeId,
        denormalizeId,
        recordPositions,
        saveLayoutCache,
    } from "../graphTools";
    import { LAYOUT_REHEAT_ALPHA, LAYOUT_REFINE_ALPHA } from "../layoutCore";
    import { pushRegistryFor } from "../ghostPush";
    import { createLayoutEngine, type LayoutEngine } from "../layoutEngine";
    import layoutWorkerSource from "virtual:layout-worker";
    import { computeInitialLayout, seedFromKnown } from "../initialLayout";
    import { NodeLayoutCache } from "../nodeLayoutCache";
    import { PinnedPeopleStorage } from "../pinnedPeopleStorage";
    import { exportChartSvg } from "../svgExport";
    import { exportChartPng } from "../pngExport";
    import { personDisplayName } from "../personDisplayName";
    import { locale, t } from "../i18n";
    import { formatLifespan } from "../partialDate";
    import { nearestTo, nextInDirection, type Direction, type Point } from "../chartKeyboard";
    import { computeClans, type Clan } from "../clans";
    import { CanvasChart, type ChartNode, type ChartLink } from "../canvasChart";

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
        /** A click on the chart that hit no node (a pan does not count). */
        onbackgroundClicked?: () => void;
        /** Show the people of these age steps (pinned and hovered branches on top of them). */
        ageSteps?: ReadonlySet<number>;
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
        onbackgroundClicked,
        ageSteps = new Set<number>(),
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
    /** The force layout; runs in a Web Worker when available. */
    let engine: LayoutEngine | null = null;
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
            const displayPeople = people.map((p) => ({ ...p, name: personDisplayName(p.name) }));
            const [nodes, relations] = makeNodesAndRelations(displayPeople, families);
            const initialPositions = computeInitialLayout(stemmaIndex, people, families, window.innerWidth, window.innerHeight);
            const clans = computeClans({ type: "Stemma", people, families });
            reconfigureGraph(chart, nodes, relations, initialPositions, clans, clanGroups(nodes, clans));
        }
    });

    $effect(() => {
        if (highlight && pinnedPeople && stemmaIndex && chart) {
            renderFullStemma();
        }
    });

    function applyStyle() {
        chart?.setStyleInputs(effectiveHighlight(highlight, stemmaIndex, ageSteps), stemmaIndex, pinnedPeople.allPinned());
    }

    $effect(() => {
        ageSteps;
        untrack(applyStyle);
    });

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
        engine?.syncFixed();
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

    export function exportPng(filename: string): Promise<void> {
        if (!chart) return Promise.resolve();
        return exportChartPng(chart.exportModel(), filename);
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
        if (!engine) return;
        if (active) engine.run({ alpha: LAYOUT_REHEAT_ALPHA, alphaTarget: 0 });
        else engine.stop();
    }

    export function applyManualPositions() {
        if (!chart) return;
        chart.positionsChanged();
        chart.updateClans();
    }

    /** Point the layout forces pull towards (the ghost burst uses the same forces). */
    export function getLayoutCenter(): [number, number] {
        return engine?.center ?? [window.innerWidth / 2, window.innerHeight / 2];
    }

    $effect(() => {
        if (!engine || !chart) return;
        const wasActive = lastSimulationActive;
        lastSimulationActive = simulationActive;
        if (simulationActive) {
            // people pushed aside by edit-mode ghosts go home before the layout runs
            if (pushRegistryFor(chart).settle()) chart.positionsChanged();
            for (const d of chart.nodes) {
                if (!d.fixed) {
                    d.fx = null;
                    d.fy = null;
                }
            }
            engine.syncFixed();
            // Leaving edit mode: let the freshly unpinned graph relax a little.
            // Nothing to do on first mount — the initial layout is already running.
            if (wasActive === false) engine.run({ alpha: LAYOUT_REHEAT_ALPHA, alphaTarget: 0 });
        } else {
            for (const d of chart.nodes) {
                if (d.x != null && d.y != null) {
                    d.fx = d.x;
                    d.fy = d.y;
                }
            }
            engine.syncFixed();
            engine.stop();
        }
    });

    $effect(() => {
        if (!hoverHighlight) clearHover();
    });

    export function setNodePosition(nodeId: string, x: number, y: number) {
        setSessionPosition(nodeId, x, y);
    }

    /** The user put a node here (edit-mode drag): it stays and is remembered there. */
    export function placeNode(nodeId: string, x: number, y: number) {
        const node = chart?.node(nodeId);
        if (!chart || !node) return;
        if (engine) engine.moveTo(node, x, y);
        else {
            node.x = x;
            node.y = y;
        }
        if (pinnedPeople && node.type === "person") {
            const personId = denormalizeId(node.id);
            if (pinnedPeople.isPinned(personId)) pinnedPeople.updatePosition(personId, x, y);
        }
        recordPositions([node]);
        saveLayoutCache();
        chart.positionsChanged();
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

    // ---- keyboard navigation and screen-reader support ----

    let keyboardId = $state<string | null>(null);
    let announcement = $state("");

    const KEY_DIRECTIONS: Record<string, Direction> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
    };

    function personPoints(): Point[] {
        if (!chart) return [];
        return chart.nodes
            .filter((n) => n.type === "person" && n.x != null && n.y != null)
            .map((n) => ({ id: n.id, x: n.x!, y: n.y! }));
    }

    function describePerson(personId: string): string {
        const p = stemmaIndex.person(personId);
        if (!p) return "";
        const span = formatLifespan(p.birthDate, p.deathDate, $locale);
        return span ? `${personDisplayName(p.name)}, ${span}` : personDisplayName(p.name);
    }

    function revealNode(node: ChartNode) {
        if (!canvasEl || node.x == null || node.y == null) return;
        const tr = d3.zoomTransform(canvasEl);
        const [sx, sy] = tr.apply([node.x, node.y]);
        const rect = canvasEl.getBoundingClientRect();
        const margin = 80;
        if (sx >= margin && sx <= rect.width - margin && sy >= margin && sy <= rect.height - margin) return;
        d3.select(canvasEl)
            .transition()
            .duration(300)
            .call(zoomHandler.transform, d3.zoomIdentity.translate(rect.width / 2 - tr.k * node.x, rect.height / 2 - tr.k * node.y).scale(tr.k));
    }

    function focusNodeById(nodeId: string) {
        const node = chart?.node(nodeId);
        if (!node) return;
        clearHover();
        hoverEnter(node);
        keyboardId = nodeId;
        announcement = describePerson(denormalizeId(nodeId));
        revealNode(node);
    }

    function onChartKeydown(e: KeyboardEvent) {
        if (!chart || !canvasEl) return;
        const dir = KEY_DIRECTIONS[e.key];
        if (dir) {
            e.preventDefault();
            const points = personPoints();
            let next: Point | null = null;
            if (keyboardId) next = nextInDirection(points, keyboardId, dir);
            if (!keyboardId || !chart.node(keyboardId)) {
                const rect = canvasEl.getBoundingClientRect();
                const [cx, cy] = d3.zoomTransform(canvasEl).invert([rect.width / 2, rect.height / 2]);
                next = nearestTo(points, cx, cy);
            }
            if (next) focusNodeById(next.id);
        } else if ((e.key === "Enter" || e.key === " ") && keyboardId) {
            e.preventDefault();
            onpersonSelected?.(stemmaIndex.person(denormalizeId(keyboardId)));
        } else if (e.key === "Escape" && keyboardId) {
            keyboardId = null;
            announcement = "";
            clearHover();
        }
    }

    function openFromList(personId: string) {
        focusNodeById(normalizeId("person", personId));
        onpersonSelected?.(stemmaIndex.person(personId));
    }

    const peopleForList = $derived(
        [...stemma.people].sort((a, b) => personDisplayName(a.name).localeCompare(personDisplayName(b.name))),
    );

    function updateHover(clientX: number, clientY: number) {
        if (!chart || isDragging) return;
        if (document.body.classList.contains("chart-gesture")) return;
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
        chart.release();
        recordPositions(chart.nodes);
        chart.positionsChanged();
        const now = performance.now();
        // While the layout runs, clouds are re-rasterised ≤10×/s; a one-off
        // update (edit-mode settle) gets them straight away.
        if (!engine?.isRunning() || now - lastClanUpdate >= CLAN_UPDATE_INTERVAL_MS) {
            lastClanUpdate = now;
            chart.updateClans();
        }
    }

    function onSimEnd() {
        layoutStats.ends++;
        layoutStats.lastEndAt = performance.now();
        saveLayoutCache();
        if (!chart) return;
        chart.layoutLabels();
        chart.updateClans();
        if (revealAfterLayout) {
            revealAfterLayout = false;
            revealNearestNode(chart);
        }
    }

    /** Set on a cold start: once laid out, make sure the view is not empty. */
    let revealAfterLayout = false;
    let revealedStemmaId: string | null = null;

    /**
     * A freshly laid-out stemma can leave the viewport centre in a gap
     * between clan regions; pan (keeping the zoom) to the nearest person.
     */
    function revealNearestNode(c: CanvasChart) {
        const t = c.transform;
        const [x0, y0] = t.invert([0, 0]);
        const [x1, y1] = t.invert([c.width, c.height]);
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        let best: ChartNode | null = null;
        let bestD = Infinity;
        for (const n of c.nodes) {
            if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1) return;
            if (n.type !== "person") continue;
            const d = (n.x - cx) ** 2 + (n.y - cy) ** 2;
            if (d < bestD) {
                bestD = d;
                best = n;
            }
        }
        if (best) applyZoomTranslate(c.width / 2 - t.k * best.x, c.height / 2 - t.k * best.y);
    }

    /** d3.forceLink used to swap link ids for node objects; the renderer relies on that. */
    function resolveLinks(nodes: ChartNode[], relations: any[]): ChartLink[] {
        const byId = new Map(nodes.map((n) => [n.id, n]));
        for (const l of relations) {
            if (typeof l.source === "string") l.source = byId.get(l.source) ?? l.source;
            if (typeof l.target === "string") l.target = byId.get(l.target) ?? l.target;
        }
        return relations.filter((l) => typeof l.source === "object" && typeof l.target === "object");
    }

    /**
     * Below this share of nodes with a remembered position the stored layout
     * is not worth keeping: lay the stemma out from scratch instead.
     */
    const WARM_START_MIN_KNOWN = 0.5;

    /** Clan index per node (largest clan for people in several, -1 for none). */
    function clanGroups(nodes: ChartNode[], clans: Clan[]): Int32Array {
        const best = new Map<string, number>();
        clans.forEach((c, i) => {
            for (const pid of c.personIds) {
                const id = normalizeId("person", pid);
                const prev = best.get(id);
                if (prev == null || clans[prev].personIds.size < c.personIds.size) best.set(id, i);
            }
        });
        return Int32Array.from(nodes, (n) => best.get(n.id) ?? -1);
    }

    function reconfigureGraph(chart: CanvasChart, nodes: any[], relations: any[], initialPositions: any, clans: Clan[], groups: Int32Array) {
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
        const links = resolveLinks(nodes, relations);

        chart.setData(nodes, links);
        chart.setClans(clans);
        applyStyle();
        if (knownFrac === 1) chart.layoutLabels();
        if (!engine) return;

        // Everything remembered: only a gentle refine. Mostly remembered: heat
        // proportional to the share of newcomers (they are already seeded next
        // to their relatives), so a few additions do not reshuffle the graph.
        // Otherwise: a full layout.
        const alpha = warm ? Math.min(LAYOUT_REHEAT_ALPHA, LAYOUT_REFINE_ALPHA + (1 - knownFrac)) : 1;
        // Cold start: the engine (worker) computes a structured starting
        // layout first; draw nothing until those positions arrive.
        const seed = !warm;
        // A newly opened stemma must not open on an empty patch of canvas:
        // remembered layouts can be checked right away, fresh ones once laid out.
        const opened = revealedStemmaId !== currentStemmaId;
        revealedStemmaId = currentStemmaId;
        if (seed) {
            chart.hold();
            revealAfterLayout = opened || revealAfterLayout;
        } else if (opened) {
            revealNearestNode(chart);
        }
        if (simulationActive) {
            engine.setGraph(nodes, links, alpha, true, seed, groups);
        } else {
            // Sim inactive (edit mode): pin every node that already had a known
            // position so the 80-tick settle only lays out genuinely new nodes,
            // leaving existing positions stable across data changes.
            for (const d of nodes) {
                if (d.hadKnownPosition && d.x != null && d.y != null) {
                    d.fx = d.x;
                    d.fy = d.y;
                }
            }
            engine.setGraph(nodes, links, alpha, false, seed, groups);
            engine.settle(80);
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
                node.fx = node.x;
                node.fy = node.y;
                engine?.pin(node);
                if (!event.active) engine?.run({ alphaTarget: 0.3 });
                isDragging = true;
            })
            .on("drag", (event: any) => {
                const node: ChartNode = event.subject.node;
                node.fx = c.transform.invertX(event.x);
                node.fy = c.transform.invertY(event.y);
                // The dragged node is main-thread authoritative: draw it under
                // the pointer now, the worker catches up with its neighbours.
                node.x = node.fx;
                node.y = node.fy;
                engine?.pin(node);
                c.positionsChanged();
            })
            .on("end", (event: any) => {
                const node: ChartNode = event.subject.node;
                if (!node.fixed) {
                    node.fx = null;
                    node.fy = null;
                }
                engine?.pin(node);
                if (!event.active) engine?.run({ alphaTarget: 0 });
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
            if (document.body.classList.contains("chart-gesture")) return;
            if (!hoverHighlight) return;
            clearHover();
        });
        canvasEl.addEventListener("click", (e) => {
            const node = c.hitNode(e.clientX, e.clientY);
            if (!node) {
                if (!c.hitGhost(e.clientX, e.clientY)) onbackgroundClicked?.();
                return;
            }
            if (node.type == "person") onpersonSelected?.(stemmaIndex.person(denormalizeId(node.id)));
            else onfamilySelected?.(stemmaIndex.family(denormalizeId(node.id)));
        });
    }

    onMount(() => {
        const c = new CanvasChart(canvasEl);
        engine = createLayoutEngine(
            [window.innerWidth / 2, window.innerHeight / 2],
            { onTick: onSimTick, onEnd: onSimEnd, onGlide: () => chart?.positionsChanged() },
            layoutWorkerSource,
        );
        setupInteractions(c);
        (window as any).__stemmaChart = {
            snapshot: () => c.snapshot(),
            layout: () => ({ ...layoutStats, firstDrawAt: c.firstDrawAt, engine: engine?.kind ?? null, running: engine?.isRunning() ?? false }),
            renderTiming: (reset = false) => {
                const r = { ...c.renderTiming };
                if (reset) c.renderTiming = { frames: 0, totalMs: 0, maxMs: 0 };
                return r;
            },
            /** Set the pan/zoom directly (benchmarks, debugging). */
            setTransform: (x: number, y: number, k: number) =>
                d3.select(canvasEl).call(zoomHandler.transform, d3.zoomIdentity.translate(x, y).scale(k)),
            /** Zoom so the whole graph fits the canvas; returns the transform. */
            fit: () => {
                if (!c.nodes.length) return null;
                const xs = c.nodes.map((n) => n.x);
                const ys = c.nodes.map((n) => n.y);
                const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
                const k = Math.min(c.width / (x1 - x0 + 100), c.height / (y1 - y0 + 100));
                const tx = c.width / 2 - k * (x0 + x1) / 2;
                const ty = c.height / 2 - k * (y0 + y1) / 2;
                d3.select(canvasEl).call(zoomHandler.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
                return { x: tx, y: ty, k };
            },
        };
        chart = c;
        onchartReady?.(c);
        return () => {
            engine?.destroy();
            engine = null;
            c.destroy();
            onchartReady?.(null);
            delete (window as any).__stemmaChart;
        };
    });
</script>

<div {hidden}>
    <canvas
        id="chart"
        class="chart-canvas"
        bind:this={canvasEl}
        tabindex="0"
        aria-label={$t("chart.a11yLabel")}
        aria-describedby="chart-people"
        onkeydown={onChartKeydown}
    ></canvas>
    <div class="visually-hidden" aria-live="polite" data-testid="chart-announcer">{announcement}</div>
    <!-- The chart is a canvas: this list gives screen readers the people in it. Items are
         reachable in browse mode but kept out of the Tab order (arrows move on the chart). -->
    <ul id="chart-people" class="visually-hidden" aria-label={$t("chart.peopleList")} data-testid="chart-people">
        {#each peopleForList as p (p.id)}
            <li><button type="button" tabindex="-1" onclick={() => openFromList(p.id)}>{describePerson(p.id)}</button></li>
        {/each}
    </ul>
</div>

<style lang="less">
    .chart-canvas {
        display: block;
        width: 100%;
        height: calc(~"100vh - 56px");
    }

    .chart-canvas:focus {
        outline: none;
    }

    .chart-canvas:focus-visible {
        outline: 2px solid #4a80c4;
        outline-offset: -2px;
    }
</style>
