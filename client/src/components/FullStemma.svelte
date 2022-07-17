<script lang="ts">
    import * as d3 from "d3";
    import { Stemma } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { GenerationSelection, SelectionController } from "../selectionController";
    import { configureSimulation, initChart, makeDrag, makeNodesAndRelations, mergeData, renderChart } from "../graphTools";

    const dispatch = createEventDispatcher();

    const hoveredPersonR = 25;
    const pin =
        "M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z";

    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;
    export let selectionController: SelectionController;

    let svg;

    $: {
        if (svg && stemma) {
            let [nodes, relations] = makeNodesAndRelations(stemma.people, stemma.families);
            reconfigureGraph(nodes, relations);
        }
    }

    $: {
        if (svg && selectionController) renderChart(svg, selectionController, stemmaIndex);
    }

    function reconfigureGraph(nodes, relations) {
        let simulation = configureSimulation(svg, nodes, relations, window.innerWidth, window.innerHeight);

        mergeData(svg, nodes, relations);

        svg.selectAll("circle")
            .on("mouseenter", function (event, node) {
                if (node.type == "person" && selectionController.personIsHighlighted(node.id)) {
                    selectionController.add(node.id, new GenerationSelection(stemmaIndex, node.id));
                    renderChart(svg, selectionController, stemmaIndex);

                    d3.select(this).attr("r", hoveredPersonR);

                    d3.select(this.parentNode)
                        .append("path")
                        .attr("d", pin)
                        .attr("transform", "translate(-7.5, -6)")
                        .attr("fill", "white");
                }
            })
            .on("mouseleave", (_event, node) => {
                if (node.type == "person") {
                    selectionController.remove(node.id);
                    renderChart(svg, selectionController, stemmaIndex);
                }
            })
            .on("click", (event, node) => {
                if (node.type == "person" && selectionController.personIsHighlighted(node.id)) {
                    let selectedPerson = stemmaIndex.get(node.id);
                    dispatch("personSelected", selectedPerson);
                }
            });

        renderChart(svg, selectionController, stemmaIndex);
        makeDrag(svg, simulation);
    }

    onMount(() => {
        svg = initChart("#chart");

        svg.call(
            d3.zoom().on("zoom", (e) => {
                svg.select("g.main").attr("transform", e.transform);
            })
        );
    });
</script>

<svg id="chart" class="w-100 p-3 fullHeight" />

<style lang="less">
    .fullHeight {
        min-height: calc(~"100vh - 56px");
    }
</style>
