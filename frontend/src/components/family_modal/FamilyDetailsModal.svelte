<script module lang="ts">
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
    import { t } from "../../i18n";

    type Props = {
        stemma: Stemma;
        stemmaIndex: StemmaIndex;
        onfamilyAdded?: (payload: { parents: PersonDefinition[]; children: PersonDefinition[] }) => void;
        onfamilyUpdated?: (payload: { familyId: string; parents: PersonDefinition[]; children: PersonDefinition[] }) => void;
        onfamilyRemoved?: (familyId: string) => void;
    };

    let { stemma, stemmaIndex, onfamilyAdded, onfamilyUpdated, onfamilyRemoved }: Props = $props();

    let modalEl = $state<HTMLElement>(null);
    let mode = $state("familyComposition");
    let createSelectEl = $state<ReturnType<typeof CreateSelectPerson>>(null);
    let selectParent = $state<boolean>(false);
    let selected = $state<CreateNewPerson | PersonDescription>(null);
    let familyId = $state<string>(null);
    let parents = $state<(CreateNewPerson | PersonDescription)[]>([]);
    let children = $state<(CreateNewPerson | PersonDescription)[]>([]);
    let readOnly = $state(false);

    const selectedParentsCount = $derived(parents.length);
    const selectedChildrenCount = $derived(children.length);

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

    function showPersonSelection(isParent: boolean) {
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
        if ("id" in pd) return { type: "ExistingPerson", id: pd.id };
        else return pd;
    }

    function saveFamily() {
        const pp = parents.map((p) => toPersonDefinition(p));
        const cc = children.map((c) => toPersonDefinition(c));

        if (familyId == null) onfamilyAdded?.({ parents: pp, children: cc });
        else onfamilyUpdated?.({ familyId, parents: pp, children: cc });

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function removeFamily() {
        onfamilyRemoved?.(familyId);
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
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
                        <button type="button" class="btn btn-primary btn-sm" onclick={() => showPersonSelection(true)}
                            ><i class="bi bi-person-plus-fill"></i> {$t("common.add")}</button
                        >
                    {/if}

                    <hr class="my-5" />

                    <p class="fs-5">{$t("family.children")}</p>
                    <FamilyGeneration bind:selectedPeople={children} {readOnly} />
                    {#if !readOnly}
                        <button type="button" class="btn btn-primary btn-sm" onclick={() => showPersonSelection(false)}
                            ><i class="bi bi-person-plus-fill"></i> {$t("common.add")}</button
                        >
                    {/if}
                {:else}
                    <CreateSelectPerson {stemma} {stemmaIndex} bind:this={createSelectEl} onselected={(p) => (selected = p)} />
                {/if}
            </div>
            {#if !readOnly}
                <div class="modal-footer">
                    {#if mode == "familyComposition"}
                        {#if familyId != null}
                            <button type="button" class="btn btn-danger me-auto" onclick={removeFamily}>{$t("common.delete")}</button>
                        {/if}
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                        <button type="button" class="btn btn-primary" disabled={selectedParentsCount + selectedChildrenCount < 2} onclick={saveFamily}
                            >{$t("common.save")}</button
                        >
                    {:else}
                        <button type="button" class="btn btn-secondary" onclick={showFamilyComposition}>{$t("common.back")}</button>
                        <button type="button" class="btn btn-primary" disabled={selected == null} onclick={confirmPersonSelection}>{$t("common.select")}</button>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
