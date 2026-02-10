<script context="module" lang="ts">
    import type { CreateNewPerson, FamilyDescription, PersonDefinition, PersonDescription } from "../../model";
    import * as bootstrap from "bootstrap";

    export type GetOrCreateFamily = {
        familyId?: string;
        parents: PersonDefinition[];
        children: PersonDefinition[];
    };
</script>

<script lang="ts">
    import type { Stemma } from "../../model";
    import { StemmaIndex } from "../../stemmaIndex";
    import CreateSelectPerson from "./CreateSelectPerson.svelte";
    import FamilyGeneration from "./FamilyGeneration.svelte";

    import { createEventDispatcher } from "svelte";
    import { t } from "../../i18n";

    let modalEl;
    let mode = "familyComposition";

    let createSelectEl;

    let selectParent: boolean;
    let selected = null;
    let familyId = null;

    let parents: (CreateNewPerson | PersonDescription)[] = [];
    let children: (CreateNewPerson | PersonDescription)[] = [];

    let selectedParentsCount, selectedChildrenCount;
    let readOnly: boolean;

    let dispatch = createEventDispatcher();

    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;

    export function showExistingFamily(details: FamilyDescription) {
        familyId = details.id;
        parents = details.parents.map((pid) => stemmaIndex.person(pid));
        children = details.children.map((cid) => stemmaIndex.person(cid));
        readOnly = details.readOnly;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    export function promptNewFamily() {
        familyId = null;
        parents = [];
        children = [];
        readOnly = false;
        showFamilyComposition();
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

    function toPersonDefinition(pd: CreateNewPerson | PersonDescription): PersonDefinition {
        if ("id" in pd) return { ExistingPerson: { id: pd.id } };
        else return { CreateNewPerson: pd as CreateNewPerson };
    }

    function saveFamily() {
        let pp = parents.map((p) => toPersonDefinition(p));
        let cc = children.map((c) => toPersonDefinition(c));

        if (familyId == null) dispatch("familyAdded", { parents: pp, children: cc });
        else dispatch("familyUpdated", { familyId: familyId, parents: pp, children: cc });

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function removeFamily() {
        dispatch("familyRemoved", familyId);
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
                <h5 class="modal-title" id="addFamlilyLabel">{mode == "familyComposition" ? $t("family.compositionTitle") : $t("family.selectMemberTitle")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" style="min-height:550px">
                {#if mode == "familyComposition"}
                    <p class="fs-5">{$t("family.parents")}</p>
                    <FamilyGeneration bind:selectedPeople={parents} {readOnly} />
                    {#if selectedParentsCount < 2 && !readOnly}
                        <button type="button" class="btn btn-primary btn-sm" on:click={(e) => showPersonSelection(true)}
                            ><i class="bi bi-person-plus-fill"></i> {$t("common.add")}</button
                        >
                    {/if}

                    <hr class="my-5" />

                    <p class="fs-5">{$t("family.children")}</p>
                    <FamilyGeneration bind:selectedPeople={children} {readOnly} />
                    {#if !readOnly}
                        <button type="button" class="btn btn-primary btn-sm" on:click={(e) => showPersonSelection(false)}
                            ><i class="bi bi-person-plus-fill"></i> {$t("common.add")}</button
                        >
                    {/if}
                {:else}
                    <CreateSelectPerson {stemma} {stemmaIndex} bind:this={createSelectEl} on:selected={(e) => (selected = e.detail)} />
                {/if}
            </div>
            {#if !readOnly}
                <div class="modal-footer">
                    {#if mode == "familyComposition"}
                        {#if familyId != null}
                            <button type="button" class="btn btn-danger me-auto" on:click={() => removeFamily()}>{$t("common.delete")}</button>
                        {/if}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                        <button type="button" class="btn btn-primary" disabled={selectedParentsCount + selectedChildrenCount < 2} on:click={(e) => saveFamily()}
                            >{$t("common.save")}</button
                        >
                    {:else}
                        <button type="button" class="btn btn-secondary" on:click={(e) => showFamilyComposition()}>{$t("common.back")}</button>
                        <button type="button" class="btn btn-primary" disabled={selected == null} on:click={(e) => confirmPersonSelection()}>{$t("common.select")}</button>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
