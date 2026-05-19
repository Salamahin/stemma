<script lang="ts">
    import type { CreateNewPerson, PersonDescription } from "../../model";
    import { StemmaIndex } from "../../stemmaIndex";
    import { onMount } from "svelte";
    import { configureSimulation, initChart, makeDrag, makeNodesAndRelations, mergeData, renderChart } from "../../graphTools";
    import { HighlightAll } from "../../highlight";

    type Props = {
        chartId: string;
        selectedPerson: PersonDescription | CreateNewPerson;
        stemmaIndex: StemmaIndex;
    };

    let { chartId, selectedPerson, stemmaIndex }: Props = $props();

    let svg = $state<any>(null);
    let markers: any = null;
    let width = $state(0);
    let height = $state(0);
    let nodes = $state<any[]>(null);
    let relations = $state<any[]>(null);
    let sim: any = null;

    onMount(() => {
        ({ svg, markers } = initChart(`#${chartId}`));
    });

    $effect(() => {
        if (svg && selectedPerson) {
            let relativies: any[], families: any[];

            if ("id" in selectedPerson) {
                relativies = stemmaIndex.relativies(selectedPerson.id);
                families = stemmaIndex.relatedFamilies(selectedPerson.id);
            } else {
                relativies = [{ id: "new_person_id", name: selectedPerson.name }];
                families = [];
            }

            [nodes, relations] = makeNodesAndRelations(relativies, families);
        }
    });

    $effect(() => {
        if (width && height && svg && nodes && relations) {
            sim = configureSimulation(svg, nodes, relations, width, height);
            mergeData(svg, nodes, relations, width, height, null, null, true);
            makeDrag(svg, sim, null);
            renderChart(svg, new HighlightAll(), stemmaIndex, markers);
        }
    });
</script>

<div bind:clientWidth={width} bind:clientHeight={height} class="h-100 w-100">
    <svg id={chartId} style="min-width: 300px; min-height: 350px; width: 100%; height: 100%"></svg>
</div>
