<script context="module" lang="ts">
    import { NewPerson, StoredPerson } from "../model";
    import * as bootstrap from "bootstrap";

    export type CreateFamily = {
        parents: (NewPerson | StoredPerson)[];
        children: (NewPerson | StoredPerson)[];
    };
</script>

<script lang="ts">
    import { Stemma } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import CreateSelectPerson from "./CreateSelectPerson.svelte";
    import FamilyComposition from "./FamilyComposition.svelte";
    import FamilyGeneration from "./FamilyGeneration.svelte";

    let familyCompositionModal;
    let createOrSelectPersonModal;

    let parentsEl;
    let childrenEl;

    let parents: (NewPerson | StoredPerson)[] = [];
    let children: (NewPerson | StoredPerson)[] = [];

    let selectedParentsCount, selectedChildrenCount;

    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;

    export function promptNewFamily() {
        parents = [];
        children = [];
        bootstrap.Modal.getOrCreateInstance(familyCompositionModal).show();
    }

    function showFamilyComposition() {
        bootstrap.Modal.getOrCreateInstance(createOrSelectPersonModal).hide();
        bootstrap.Modal.getOrCreateInstance(familyCompositionModal).show();
    }

    function showPersonSelection() {
        bootstrap.Modal.getOrCreateInstance(familyCompositionModal).hide();
        bootstrap.Modal.getOrCreateInstance(createOrSelectPersonModal).show();
    }

    $: {
        selectedParentsCount = parents ? parents.length : 0;
        selectedChildrenCount = children ? children.length : 0;
    }
</script>

<div
    class="modal fade"
    data-bs-backdrop="static"
    data-bs-keyboard="false"
    tabindex="-1"
    aria-labelledby="addFamlilyLabel"
    aria-hidden="true"
    bind:this={familyCompositionModal}
>
    <div class="modal-dialog modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addFamlilyLabel">Добавить семью или членов семьи</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <p class="fs-5">Родители</p>
                <FamilyGeneration {stemma} {stemmaIndex} bind:selectedPeople={parents} maxPeople={2} on:create={(e) => showPersonSelection()} />
                <p class="fs-5 mt-5">Дети</p>
                <FamilyGeneration {stemma} {stemmaIndex} bind:selectedPeople={children} maxPeople={20} on:create={(e) => showPersonSelection()} />
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-primary" disabled={selectedParentsCount + selectedChildrenCount < 2}>Сохранить семью</button>
            </div>
        </div>
    </div>
</div>

<div
    class="modal fade"
    data-bs-backdrop="static"
    data-bs-keyboard="false"
    tabindex="-1"
    aria-labelledby="addFamlilyLabel"
    aria-hidden="true"
    bind:this={createOrSelectPersonModal}
>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addFamlilyLabel">Создать или выбрать человека</h5>
                <button type="button" class="btn-close" aria-label="Close" on:click={(e) => showFamilyComposition()} />
            </div>
            <div class="modal-body">
                <CreateSelectPerson {stemma} {stemmaIndex} />
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" on:click={(e) => showFamilyComposition()}>Отменить</button>
                <button type="button" class="btn btn-primary">Подтвердить</button>
            </div>
        </div>
    </div>
</div>
