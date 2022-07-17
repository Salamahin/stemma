<script context="module" lang="ts">
    import { NewPerson, StoredPerson } from "../../model";
    import * as bootstrap from "bootstrap";

    export type CreateFamily = {
        parents: (NewPerson | StoredPerson)[];
        children: (NewPerson | StoredPerson)[];
    };
</script>

<script lang="ts">
    import { Stemma } from "../../model";
    import { StemmaIndex } from "../../stemmaIndex";
    import CreateSelectPerson from "./CreateSelectPerson.svelte";
    import FamilyGeneration from "./FamilyGeneration.svelte";

    import { createEventDispatcher } from "svelte";

    let modalEl;
    let mode = "familyComposition";

    let createSelectEl;

    let selectParent: boolean;
    let selected = null;

    let parents: (NewPerson | StoredPerson)[] = [];
    let children: (NewPerson | StoredPerson)[] = [];

    let selectedParentsCount, selectedChildrenCount;

    let dispatch = createEventDispatcher();

    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;

    export function promptNewFamily() {
        parents = [];
        children = [];
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    function showFamilyComposition() {
        mode = "familyComposition";
    }

    function showPersonSelection(isParent) {
        selectParent = isParent;

        if (createSelectEl) createSelectEl.reset();
        selected = null;

        mode = "personSelection";
    }

    function confirmPersonSelection() {
        if (selectParent) parents = [...parents, { ...selected }];
        else children = [...children, { ...selected }];

        showFamilyComposition();
    }

    function createFamily() {
        dispatch("familyAdded", { parents: parents, children: children });
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
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
    bind:this={modalEl}
>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addFamlilyLabel">{mode == "familyComposition" ? "Состав семьи" : "Выбрать члена семьи"}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                {#if mode == "familyComposition"}
                    <p class="fs-5">Родители</p>
                    <FamilyGeneration bind:selectedPeople={parents} />
                    {#if selectedParentsCount < 2}
                        <button type="button" class="btn btn-primary btn-sm" on:click={(e) => showPersonSelection(true)}
                            ><i class="bi bi-person-plus-fill" /> добавить</button
                        >
                    {/if}

                    <hr class="my-5" />

                    <p class="fs-5">Дети</p>
                    <FamilyGeneration bind:selectedPeople={children} />
                    <button type="button" class="btn btn-primary btn-sm" on:click={(e) => showPersonSelection(false)}
                        ><i class="bi bi-person-plus-fill" /> добавить</button
                    >
                {:else}
                    <CreateSelectPerson {stemma} {stemmaIndex} bind:this={createSelectEl} on:selected={(e) => (selected = e.detail)} />
                {/if}
            </div>
            <div class="modal-footer">
                {#if mode == "familyComposition"}
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                    <button type="button" class="btn btn-primary" disabled={selectedParentsCount + selectedChildrenCount < 2} on:click={(e) => createFamily()}
                        >Сохранить</button
                    >
                {:else}
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" on:click={(e) => showFamilyComposition()}>Назад</button>
                    <button type="button" class="btn btn-primary" disabled={selected == null} on:click={(e) => confirmPersonSelection()}>Выбрать</button>
                {/if}
            </div>
        </div>
    </div>
</div>
