<script lang="ts">
    import type { CreateNewPerson, PersonDescription } from "../../model";
    import { StemmaIndex } from "../../stemmaIndex";
    import { onMount } from "svelte";
    import { configureSimulation, initChart, makeDrag, makeNodesAndRelations, mergeData, renderChart } from "../../graphTools";
    import { HighlightAll } from "../../highlight";

    export let chartId;
    export let selectedPerson: PersonDescription | CreateNewPerson;
    export let stemmaIndex: StemmaIndex;

    let svg;
    let width, height;
    let nodes, relations;
    let sim;

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

            [nodes, relations] = makeNodesAndRelations(relativies, families);
        }
    }

    $: {
        if (width && height && svg && nodes && relations) {
            sim = configureSimulation(svg, nodes, relations, width, height);
            mergeData(svg, nodes, relations, width, height, true);
            makeDrag(svg, sim);
            renderChart(svg, new HighlightAll(), stemmaIndex);
        }
    }
</script>

<div bind:clientWidth={width} bind:clientHeight={height} class="h-100 w-100">
    <svg id={chartId} style="min-width: 300px; min-height: 350px; width: 100%; height: 100%"></svg>
</div>
