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
    import AddPeopleComponent from "./AddPeopleComponent.svelte";
    import { Stemma } from "../model";
    import { Lineage } from "../generation";

    const dispatch = createEventDispatcher();

    let modalEl;
    let parentsEl;
    let childrenEl;

    export let stemma: Stemma;
    export let lineage: Lineage;

    export function promptNewFamily() {
        // parentsEl.reset();
        // childrenEl.reset();
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    function familyCreated() {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        dispatch("familyAdded", { parents: parentsEl.selected(), children: childrenEl.selected() } as CreateFamily);
    }

    let selectedParentsCount, selectedChildrenCount;
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
                <h5 class="modal-title" id="addFamlilyLabel">Добавить семью</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <p class="fs-5 text-center">Родители</p>
                <AddPeopleComponent maxPeopleCount={2} bind:stemma bind:lineage bind:this={parentsEl} />
                <p class="fs-5 text-center mt-5">Дети</p>
                <AddPeopleComponent maxPeopleCount={20} bind:stemma bind:lineage bind:this={childrenEl} />
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
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
