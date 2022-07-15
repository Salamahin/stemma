<script lang="ts">
    import { NewPerson, StoredPerson } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { onMount } from "svelte";
    import { configureSimulation, initChart, makeDrag, makeNodesAndRelations, mergeData, renderChart } from "../graphTools";
    import { HighlightAll } from "../selectionController";

    export let chartId;
    export let selectedPerson: StoredPerson | NewPerson;
    export let stemmaIndex: StemmaIndex;

    let svg;

    onMount(() => {
        svg = initChart(`#${chartId}`);
    });

    $: {
        if (svg && selectedPerson) {
            let relativies, families;

            if ("id" in selectedPerson) {
                relativies = stemmaIndex.relativies(selectedPerson.id);
                families = stemmaIndex.relatedFamilies(selectedPerson.id);
            } else {
                relativies = [{ id: "new_person_id", name: selectedPerson.name }];
                families = [];
            }

            let [nodes, relations] = makeNodesAndRelations(relativies, families);
            reconfigureGraph(nodes, relations);
        }
    }

    function reconfigureGraph(nodes, relations) {
        let container = document.getElementById(chartId);
        let sim = configureSimulation(svg, nodes, relations, container.clientWidth, container.clientHeight);
        mergeData(svg, nodes, relations);
        makeDrag(svg, sim);
        renderChart(svg, new HighlightAll(), stemmaIndex);
    }
</script>

<svg id={chartId} class="w-100 h-100" style="min-width: 250px;min-height:500px" />
