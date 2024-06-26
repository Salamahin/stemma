<script lang="ts">
    import * as d3 from "d3";
    import { Stemma, ViewMode } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { HiglightLineages } from "../highlight";
    import {
        configureSimulation,
        saveCoordinates,
        loadCoordinates,
        initChart,
        makeDrag,
        makeNodesAndRelations,
        mergeData,
        normalizeId,
        renderChart,
        updateSimulation,
        denormalizeId,
    } from "../graphTools";
    import { PinnedPeopleStorage } from "../pinnedPeopleStorage";

    const dispatch = createEventDispatcher();

    const hoveredPersonR = 25;
    const hoveredFamilyR = 10;
    const pin =
        "M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z";

    export let stemma: Stemma;
    export let currentStemmaId: string;
    export let stemmaIndex: StemmaIndex;
    export let highlight: HiglightLineages;
    export let pinnedPeople: PinnedPeopleStorage;
    export let hidden: boolean;
    export let viewMode: ViewMode;

    window.addEventListener("beforeunload", (e) => {
        saveCoordinates(currentStemmaId);
    });

    let svg;

    $: if (svg && stemma) {
        loadCoordinates(currentStemmaId);
        let nodes, relations;
        
        if (viewMode == ViewMode.ALL) {
            [nodes, relations] = makeNodesAndRelations(stemma.people, stemma.families);
        } else if (viewMode == ViewMode.EDITABLE_ONLY) {
            [nodes, relations] = makeNodesAndRelations(
                stemma.people.filter((p) => !p.readOnly),
                stemma.families.filter((f) => !f.readOnly)
            );
        }

        reconfigureGraph(nodes, relations);
    }

    $: if (highlight && pinnedPeople && stemmaIndex && svg) {
        renderFullStemma();
    }

    function renderFullStemma() {
        renderChart(svg, highlight, stemmaIndex);

        d3.selectAll("path.pin").remove();
        d3.select("g.main")
            .selectAll("g")
            .each((d) => {
                d.fixed = false;
            });

        pinnedPeople
            .allPinned()
            .map((id) => normalizeId("person", id))
            .forEach((personId) => {
                d3.select(`#${personId}`)
                    .append("path")
                    .attr("d", pin)
                    .attr("class", "pin")
                    .attr("transform", "translate(-8.25, -6)")
                    .attr("fill", "white")
                    .each((d) => {
                        d.fixed = true;
                        d.fx = d.x;
                        d.fy = d.y;
                    });
            });

        d3.select("g.main")
            .selectAll("g")
            .each((d) => {
                if (!d.fixed) {
                    d.fx = null;
                    d.fy = null;
                }
            });

        simulation.alphaTarget(0.1).restart();
    }

    const zoomHandler = d3.zoom().on("zoom", (e) => {
        svg.select("g.main").attr("transform", e.transform);
    });

    export function zoomToNode(id: string) {
        let scaleZoom = 2;
        let node = d3.select("#" + normalizeId("person", id));
        if (node.size()) {
            let nodeDatum = node.datum();

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

    let simulation;
    function reconfigureGraph(nodes, relations) {
        if (!simulation) simulation = configureSimulation(svg, nodes, relations, window.innerWidth, window.innerHeight);
        else updateSimulation(simulation, nodes, relations);

        mergeData(svg, nodes, relations, window.innerWidth, window.innerHeight, false);

        svg.select("g.main")
            .selectAll("g")
            .on("mouseenter", function (event, node) {
                if (node.type == "person") {
                    highlight.pushPerson(denormalizeId(node.id));
                    renderFullStemma();
                    d3.select(this).select("circle").attr("r", hoveredPersonR);
                    d3.select(this).select("text").attr("font-weight", "bold");
                }
                if (node.type == "family") {
                    highlight.pushFamily(denormalizeId(node.id));
                    renderFullStemma();
                    d3.select(this).select("circle").attr("r", hoveredFamilyR);
                }
            })
            .on("mouseleave", (_event, node) => {
                highlight.pop();
                renderFullStemma();
            })
            .on("click", (event, node) => {
                if (node.type == "person") {
                    let selectedPerson = stemmaIndex.person(denormalizeId(node.id));
                    dispatch("personSelected", selectedPerson);
                }

                if (node.type == "family") {
                    let selectedFamily = stemmaIndex.family(denormalizeId(node.id));
                    dispatch("familySelected", selectedFamily);
                }
            });

        renderChart(svg, highlight, stemmaIndex);
        makeDrag(svg, simulation, currentStemmaId);
    }

    onMount(() => {
        svg = initChart("#chart");
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
