<script context="module" lang="ts">
    import { NewPerson, StoredPerson } from "../model";
    import * as bootstrap from "bootstrap";

    export type CreateFamily = {
        parents: (NewPerson | StoredPerson)[];
        children: (NewPerson | StoredPerson)[];
    };
</script>

<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import AddPeopleComponent, { PersonChoice } from "./AddPeopleComponent.svelte";
    import { Stemma } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { RestrictiveSelectionController, SelectionController } from "../selectionController";

    const dispatch = createEventDispatcher();

    let modalEl;
    let parentsEl;
    let childrenEl;

    let parents;
    let children;

    let selectedParentsCount, selectedChildrenCount;

    let promptingParentId = -1;
    let promptingChildId = -1;

    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;
    export let selectionController: SelectionController;
    let oldSelectionController: SelectionController;

    export function promptNewFamily() {
        reset();
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    export function awaitsPersonSelection() {
        return promptingParentId >= 0 || promptingChildId >= 0;
    }

    function reset() {
        parentsEl.reset();
        childrenEl.reset();

        promptingParentId = -1;
        promptingChildId = -1;
    }

    function familyCreated() {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        dispatch("familyAdded", { parents: parents, children: children } as CreateFamily);
    }

    function promptParentSelection(event: PersonChoice) {
        promptingParentId = event.index;
        promtPersonSelection(event);
    }

    function promptChildSelection(event: PersonChoice) {
        promptingChildId = event.index;
        promtPersonSelection(event);
    }

    function promtPersonSelection(event: PersonChoice) {
        oldSelectionController = selectionController;
        selectionController = new RestrictiveSelectionController(event.personIds);

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    export function personSelected(person: StoredPerson) {
        selectionController = oldSelectionController;

        if (promptingParentId >= 0) parentsEl.set(promptingParentId, person);
        else if (promptingChildId >= 0) childrenEl.set(promptingChildId, person);

        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    $: {
        selectedParentsCount = parents ? parents.length : 0;
        selectedChildrenCount = children ? children.length : 0;
    }
</script>

<div
    class="modal fade"
    id="addFamilyModal"
    data-bs-backdrop="static"
    data-bs-keyboard="false"
    tabindex="-1"
    aria-labelledby="addFamlilyLabel"
    aria-hidden="true"
    bind:this={modalEl}
>
    <div class="modal-dialog modal-dialog-centered modal-xl">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addFamlilyLabel">Добавить семью или членов семьи</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" on:click={(e) => reset()} />
            </div>
            <div class="modal-body">
                <p class="fs-5 text-center">Родители</p>
                <AddPeopleComponent
                    maxPeopleCount={2}
                    bind:stemma
                    bind:stemmaIndex
                    bind:this={parentsEl}
                    on:selected={(e) => (parents = e.detail)}
                    on:choose={(e) => promptParentSelection(e.detail)}
                />
                <p class="fs-5 text-center mt-5">Дети</p>
                <AddPeopleComponent
                    maxPeopleCount={20}
                    bind:stemma
                    bind:stemmaIndex
                    bind:this={childrenEl}
                    on:selected={(e) => (children = e.detail)}
                    on:choose={(e) => promptChildSelection(e.detail)}
                />
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" on:click={(e) => reset()}>Отмена</button>
                <button type="button" class="btn btn-primary" on:click={() => familyCreated()} disabled={selectedParentsCount + selectedChildrenCount < 2}
                    >Добавить</button
                >
            </div>
        </div>
    </div>
</div>

<style>
    body .modal-dialog {
        max-width: 100%;
        width: auto !important;
        display: inline-block;
    }
</style>
