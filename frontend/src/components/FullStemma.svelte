<script lang="ts">
    import * as d3 from "d3";
    import type { Stemma } from "../model";
    import { ViewMode } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { onMount } from "svelte";
    import { HiglightLineages } from "../highlight";
    import {
        applyLabelLayout,
        configureSimulation,
        resetSessionPositions,
        setActiveLayoutCache,
        setSessionPosition,
        initChart,
        makeDrag,
        makeNodesAndRelations,
        mergeData,
        normalizeId,
        renderChart,
        updateSimulation,
        denormalizeId,
    } from "../graphTools";
    import { computeInitialLayout } from "../initialLayout";
    import { NodeLayoutCache } from "../nodeLayoutCache";
    import { PinnedPeopleStorage } from "../pinnedPeopleStorage";
    import { exportChartSvg } from "../svgExport";
    import { personDisplayName } from "../personDisplayName";
    import { t } from "../i18n";

    type Props = {
        stemma: Stemma;
        currentStemmaId: string;
        stemmaIndex: StemmaIndex;
        highlight: HiglightLineages;
        pinnedPeople: PinnedPeopleStorage;
        hidden: boolean;
        viewMode: ViewMode;
        simulationActive?: boolean;
        onpersonSelected?: (person: any) => void;
        onfamilySelected?: (family: any) => void;
        onhighlightChanged?: () => void;
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
        onpersonSelected,
        onfamilySelected,
        onhighlightChanged,
    }: Props = $props();

    const hoveredPersonR = 25;
    const hoveredFamilyR = 10;
    const pin =
        "M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z";

    let svg = $state<any>(null);
    let markers: any = null;
    let isDragging = false;
    let pendingMouseLeave = false;
    let layoutCache: NodeLayoutCache | null = null;
    let layoutCacheStemmaId: string | null = null;
    let simulation: any = null;

    $effect(() => {
        if (svg && stemma) {
            if (layoutCacheStemmaId !== currentStemmaId) {
                if (layoutCache) layoutCache.save();
                layoutCache = new NodeLayoutCache(currentStemmaId);
                layoutCache.load();
                layoutCacheStemmaId = currentStemmaId;
            }
            setActiveLayoutCache(layoutCache);
            resetSessionPositions(currentStemmaId);

            let people: any[], families: any[];

            if (viewMode == ViewMode.ALL) {
                people = stemma.people;
                families = stemma.families;
            } else if (viewMode == ViewMode.EDITABLE_ONLY) {
                people = stemma.people.filter((p) => !p.readOnly);
                families = stemma.families.filter((f) => !f.readOnly);
            }

            const displayPeople = people.map((p) => ({ ...p, name: personDisplayName(p.name, $t) }));
            const [nodes, relations] = makeNodesAndRelations(displayPeople, families);
            const initialPositions = computeInitialLayout(stemmaIndex, people, families, window.innerWidth, window.innerHeight);
            reconfigureGraph(nodes, relations, initialPositions);
        }
    });

    $effect(() => {
        if (highlight && pinnedPeople && stemmaIndex && svg) {
            renderFullStemma();
        }
    });

    function renderFullStemma() {
        renderChart(svg, highlight, stemmaIndex, markers);

        d3.selectAll("path.pin").remove();
        d3.select("g.main")
            .selectAll("g")
            .each((d) => {
                d.fixed = false;
            });

        pinnedPeople
            .allPinned()
            .forEach((personId) => {
                const nodeId = normalizeId("person", personId);
                d3.select(`#${nodeId}`)
                    .append("path")
                    .attr("d", pin)
                    .attr("class", "pin")
                    .attr("transform", "translate(-8.25, -6)")
                    .attr("fill", "white")
                    .each((d) => {
                        d.fixed = true;
                        d.fx = d.x;
                        d.fy = d.y;
                        if (!pinnedPeople.getPosition(personId)) {
                            pinnedPeople.updatePosition(personId, d.x, d.y);
                        }
                    });
            });

        d3.select("g.main")
            .selectAll("g")
            .each((d) => {
                if (!d.fixed && simulationActive) {
                    d.fx = null;
                    d.fy = null;
                }
            });

        if (simulationActive) simulation.alphaTarget(0.1).restart();
        else simulation.alphaTarget(0).stop();
    }

    const zoomHandler = d3.zoom().on("zoom", (e) => {
        svg.select("g.main").attr("transform", e.transform);
    });

    export function exportSvg(filename: string) {
        if (!svg) return;
        const node = svg.node() as SVGSVGElement | null;
        if (node) exportChartSvg(node, filename);
    }

    export function setSimulationActive(active: boolean) {
        if (!simulation) return;
        if (active) simulation.alphaTarget(0.1).restart();
        else simulation.alphaTarget(0).stop();
    }

    function applyManualPositions() {
        if (!svg) return;
        svg.select("g.main").selectAll("g").attr("transform", (d: any) => {
            if (d && d.x != null && d.y != null) return `translate(${d.x},${d.y})`;
            return null;
        });
        svg.selectAll("line")
            .attr("x1", (d: any) => d.source?.x ?? 0)
            .attr("y1", (d: any) => d.source?.y ?? 0)
            .attr("x2", (d: any) => d.target?.x ?? 0)
            .attr("y2", (d: any) => d.target?.y ?? 0);
    }

    $effect(() => {
        if (!simulation) return;
        if (simulationActive) {
            d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
                if (d && !d.fixed) {
                    d.fx = null;
                    d.fy = null;
                }
            });
            simulation.alphaTarget(0.1).restart();
        } else {
            d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
                if (d && d.x != null && d.y != null) {
                    d.fx = d.x;
                    d.fy = d.y;
                }
            });
            simulation.alphaTarget(0).stop();
        }
    });

    export function setNodePosition(nodeId: string, x: number, y: number) {
        setSessionPosition(nodeId, x, y);
    }

    export function popHover() {
        if (!highlight || !svg) return;
        highlight.pop();
        renderFullStemma();
    }

    export function zoomToNode(id: string) {
        const scaleZoom = 2;
        const node = d3.select("#" + normalizeId("person", id));
        if (node.size()) {
            const nodeDatum = node.datum() as any;

            svg.transition()
                .duration(750)
                .call(
                    zoomHandler.transform,
                    d3.zoomIdentity
                        .translate(window.innerWidth * 0.5 - scaleZoom * nodeDatum.x, window.innerHeight * 0.5 - scaleZoom * nodeDatum.y)
                        .scale(scaleZoom)
                );
        }
    }

    function reconfigureGraph(nodes: any[], relations: any[], initialPositions: any) {
        const fullyCached =
            !!layoutCache && nodes.length > 0 && layoutCache.coverage(nodes.map((n) => n.id)) === 1;

        if (!simulation) simulation = configureSimulation(svg, nodes, relations, window.innerWidth, window.innerHeight);
        else updateSimulation(simulation, nodes, relations);

        mergeData(svg, nodes, relations, window.innerWidth, window.innerHeight, initialPositions, pinnedPeople);

        if (fullyCached) simulation.alphaTarget(0).alpha(0);
        if (!simulationActive) {
            // Sim inactive (edit mode): pin every node that already had a known
            // position so the 80-tick settle only lays out genuinely new nodes,
            // leaving existing positions stable across data changes.
            d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
                if (d && d.hadKnownPosition && d.x != null && d.y != null) {
                    d.fx = d.x;
                    d.fy = d.y;
                }
            });
            simulation.tick(80);
            applyManualPositions();
            simulation.alphaTarget(0).stop();
        }

        svg.select("g.main")
            .selectAll("g")
            .on("mouseenter", function (event: any, node: any) {
                if (isDragging) {
                    pendingMouseLeave = false;
                    return;
                }
                if (document.body.classList.contains("v2-linking")) return;
                if (node.type == "person") {
                    highlight.pushPerson(denormalizeId(node.id));
                    renderFullStemma();
                    onhighlightChanged?.();
                    d3.select(this).select("circle").attr("r", hoveredPersonR);
                    d3.select(this).select("text").attr("font-weight", "bold");
                }
                if (node.type == "family") {
                    highlight.pushFamily(denormalizeId(node.id));
                    renderFullStemma();
                    onhighlightChanged?.();
                    d3.select(this).select("circle").attr("r", hoveredFamilyR);
                }
            })
            .on("mouseleave", (_event: any, _node: any) => {
                if (isDragging) {
                    pendingMouseLeave = true;
                    return;
                }
                if (document.body.classList.contains("v2-linking")) return;
                highlight.pop();
                renderFullStemma();
                onhighlightChanged?.();
            })
            .on("click", (_event: any, node: any) => {
                if (node.type == "person") {
                    const selectedPerson = stemmaIndex.person(denormalizeId(node.id));
                    onpersonSelected?.(selectedPerson);
                }

                if (node.type == "family") {
                    const selectedFamily = stemmaIndex.family(denormalizeId(node.id));
                    onfamilySelected?.(selectedFamily);
                }
            });

        renderChart(svg, highlight, stemmaIndex, markers);
        if (fullyCached) applyLabelLayout(svg, nodes);
        makeDrag(
            svg,
            simulation,
            pinnedPeople,
            () => {
                isDragging = true;
            },
            () => {
                isDragging = false;
                if (pendingMouseLeave) {
                    pendingMouseLeave = false;
                    highlight.pop();
                    renderFullStemma();
                    onhighlightChanged?.();
                }
            }
        );
    }

    onMount(() => {
        ({ svg, markers } = initChart("#chart"));
        svg.call(zoomHandler);
    });
</script>

<div {hidden}>
    <svg id="chart" class="w-100 p-3 fullHeight" />
</div>

<style lang="less">
    .fullHeight {
        min-height: calc(~"100vh - 56px");
    }
</style>
