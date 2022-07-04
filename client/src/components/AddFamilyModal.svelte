<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { onMount } from "svelte";
    import AddPeopleComponent, { PersonChangedEvent } from "./AddPeopleComponent.svelte";
    import { Stemma } from "../model";

    const dispatch = createEventDispatcher();

    let modalEl;
    let parentsEl;
    let childrenEl;

    function onPersonChanged(event: PersonChangedEvent, el) {
        let peopleWithSameName = stemma.people.filter((p) => p.name == event.descr.name);
        if (peopleWithSameName.length) el.propose(event.index, peopleWithSameName);
    }

    export let stemma: Stemma;
    export function promptNewFamily() {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
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
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addFamlilyLabel">Добавить семью</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <p class="fs-5 text-center">Родители</p>
                <AddPeopleComponent maxPeopleCount={2} on:personChanged={(e) => onPersonChanged(e.detail, parentsEl)} bind:this={parentsEl} />
                <p class="fs-5 text-center mt-5">Дети</p>
                <AddPeopleComponent maxPeopleCount={20} on:personChanged={(e) => onPersonChanged(e.detail, childrenEl)} bind:this={childrenEl} />
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-primary" on:click={() => promptNewFamily()}>Добавить</button>
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
