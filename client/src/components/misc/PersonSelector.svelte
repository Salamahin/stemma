<script lang="ts">
    import { CreateNewPerson, PersonDescription } from "../../model";
    import { createEventDispatcher } from "svelte";
    import VisualPersonDescription from "./VisualPersonDescription.svelte";
    import { StemmaIndex } from "../../stemmaIndex";

    let dispatch = createEventDispatcher();
    let selectedPerson: CreateNewPerson | PersonDescription;

    function tabName(p: PersonDescription | CreateNewPerson, i: number) {
        if ("id" in p) return `Тезка ${i + 1}`;
        else return `Создать нового`;
    }

    function selectPerson(p: PersonDescription | CreateNewPerson) {
        selectedPerson = p;
    }

    export let people: (CreateNewPerson | PersonDescription)[] = [];
    export let stemmaIndex: StemmaIndex;

    $: if (people) selectedPerson = people[0];
    $: if (selectedPerson) dispatch("select", selectedPerson);
</script>

{#if people && people.length}
    <div class="container h-100 w-100 p-0">
        <div class="d-flex flex-column h-100">
            <div class="flex-shrink-1">
                <ul class="nav nav-tabs">
                    {#each people as p, i}
                        <li class="nav-item">
                            <a
                                class="nav-link {p == selectedPerson ? 'active' : ''}"
                                aria-current={p == selectedPerson ? "page" : null}
                                href="#"
                                on:click={() => selectPerson(p)}>{tabName(p, i)}</a
                            >
                        </li>
                    {/each}
                </ul>
            </div>
            <div class="flex-grow-1">
                <VisualPersonDescription {stemmaIndex} {selectedPerson} chartId={"ns_chart"} />
            </div>
        </div>
    </div>
{/if}
