<script lang="ts">
    import type { CreateNewPerson, PersonDescription } from "../../model";
    import { createEventDispatcher } from "svelte";
    import VisualPersonDescription from "./VisualPersonDescription.svelte";
    import { StemmaIndex } from "../../stemmaIndex";
    import { t } from "../../i18n";
    import { filterEditablePeople } from "../../personSelectionRules";

    let dispatch = createEventDispatcher();
    let selectedPerson: CreateNewPerson | PersonDescription;

    function tabName(p: PersonDescription | CreateNewPerson, i: number) {
        if ("id" in p) return $t("personSelector.namesake", { index: String(i + 1) });
        else return $t("personSelector.createNew");
    }

    function selectPerson(p: PersonDescription | CreateNewPerson) {
        selectedPerson = p;
    }

    export let people: (CreateNewPerson | PersonDescription)[] = [];
    export let stemmaIndex: StemmaIndex;

    $: filteredPeople = filterEditablePeople(people);
    $: if (filteredPeople) selectedPerson = filteredPeople[0];
    $: if (selectedPerson) dispatch("select", selectedPerson);
</script>

{#if filteredPeople && filteredPeople.length}
    <div class="container h-100 w-100 p-0">
        <div class="d-flex flex-column h-100">
            <div class="flex-shrink-1">
                <ul class="nav nav-tabs">
                    {#each filteredPeople as p, i}
                        <li class="nav-item">
                            <a
                                class="nav-link {p == selectedPerson ? 'active' : ''}"
                                aria-current={p == selectedPerson ? "page" : null}
                                href="/"
                                on:click|preventDefault={() => selectPerson(p)}>{tabName(p, i)}</a
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
