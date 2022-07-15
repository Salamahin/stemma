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
            .on("mouseenter", (event, node) => {
                if (node.type == "person" && selectionController.personIsHighlighted(node.id)) {
                    selectionController.add(node.id, new GenerationSelection(stemmaIndex, node.id));
                    renderChart(svg, selectionController, stemmaIndex);

                    svg.selectAll("circle")
                        .filter((n) => n.id == node.id)
                        .attr("r", hoveredPersonR);
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
        makeDrag(svg, simulation)
    }

    onMount(() => {
        svg = initChart("#chart");

        svg.call(
            d3.zoom().on("zoom", (e) => {
                console.log("zoom!!")
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
