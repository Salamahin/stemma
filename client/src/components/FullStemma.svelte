<script lang="ts">
    import * as d3 from "d3";
    import { Stemma } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { HiglightLineages } from "../highlight";
    import { configureSimulation, initChart, makeDrag, makeNodesAndRelations, mergeData, normalizeId, renderChart, updateSimulation } from "../graphTools";
    import { PinnedPeopleStorage } from "../pinnedPeopleStorage";

    const dispatch = createEventDispatcher();

    const hoveredPersonR = 25;
    const hoveredFamilyR = 10;
    const pin =
        "M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z";

    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;
    export let highlight: HiglightLineages;
    export let pinnedPeople: PinnedPeopleStorage;

    let svg;

    $: if (svg && stemma) {
        let [nodes, relations] = makeNodesAndRelations(stemma.people, stemma.families);
        reconfigureGraph(nodes, relations);
    }

    $: if (highlight && pinnedPeople && stemmaIndex) {
        renderFullStemma();
    }

    function renderFullStemma() {
        renderChart(svg, highlight, stemmaIndex);

        d3.selectAll("path.pin").remove();
        pinnedPeople.allPinned().forEach((personId) => {
            d3.select("#" + normalizeId(personId))
                .append("path")
                .attr("d", pin)
                .attr("class", "pin")
                .attr("transform", "translate(-7.5, -6)")
                .attr("fill", "white");
        });
    }

    const zoomHandler = d3.zoom().on("zoom", (e) => {
        svg.select("g.main").attr("transform", e.transform);
    });

    export function zoomToNode(id: string) {
        var scaleZoom = 2;
        var nodeDatum = d3.select("#" + normalizeId(id)).datum();

        svg.transition()
            .duration(750)
            .call(
                zoomHandler.transform,
                d3.zoomIdentity
                    .translate(window.innerWidth * 0.5 - scaleZoom * nodeDatum.x, window.innerHeight * 0.5 - scaleZoom * nodeDatum.y)
                    .scale(scaleZoom)
            );
    }

    let simulation;
    function reconfigureGraph(nodes, relations) {
        if(!simulation) simulation = configureSimulation(svg, nodes, relations, window.innerWidth, window.innerHeight);
        else updateSimulation(simulation, nodes, relations)

        mergeData(svg, nodes, relations, window.innerWidth, window.innerHeight);

        svg.select("g.main")
            .selectAll("g")
            .on("mouseenter", function (event, node) {
                if (node.type == "person") {
                    highlight.pushPerson(node.id);
                    renderFullStemma();
                    d3.select(this).select("circle").attr("r", hoveredPersonR);
                    d3.select(this).select("text").attr("font-weight", "bold");
                }
                if (node.type == "family") {
                    highlight.pushFamily(node.id);
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
                    let selectedPerson = stemmaIndex.person(node.id);
                    dispatch("personSelected", selectedPerson);
                }

                if (node.type == "family") {
                    let selectedFamily = stemmaIndex.family(node.id);
                    dispatch("familySelected", selectedFamily);
                }
            });

        renderChart(svg, highlight, stemmaIndex);
        makeDrag(svg, simulation);
    }

    onMount(() => {
        svg = initChart("#chart");
        svg.call(zoomHandler);
    });
</script>

<svg id="chart" class="w-100 p-3 fullHeight" />

<style lang="less">
    .fullHeight {
        min-height: calc(~"100vh - 56px");
    }
</style>
