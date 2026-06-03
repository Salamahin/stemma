<script lang="ts">
    import type { Stemma, FamilyDescription, PersonDescription, CreateNewPerson } from "../../model";
    import type { StemmaIndex } from "../../stemmaIndex";
    import { t } from "../../i18n";
    import CreateSelectPerson from "../../components/family_modal/CreateSelectPerson.svelte";
    import { personDisplayName } from "../../personDisplayName";

    type StubContext = {
        stubId: string;
        anchorPersonId: string;
        anchorRole: "parent" | "child";
    };

    type FamilyFromStubPayload = {
        stubId: string;
        anchorPersonId: string;
        anchorRole: "parent" | "child";
        action: "addChild" | "addSpouse";
        newPerson?: CreateNewPerson;
        existingPersonId?: string;
    };

    type ChildInFamilyPayload = { familyId: string; person: CreateNewPerson | { type: "ExistingPerson"; id: string } };
    type SpouseInFamilyPayload = { familyId: string; person: CreateNewPerson | { type: "ExistingPerson"; id: string } };

    type Props = {
        stemma: Stemma;
        stemmaIndex: StemmaIndex | null;
        editMode: boolean;
        familyId: string | null;
        stubCtx: StubContext | null;
        oncreateFamilyFromStub?: (payload: FamilyFromStubPayload) => void;
        oncreateChildInFamily?: (payload: ChildInFamilyPayload) => void;
        oncreateSpouseInFamily?: (payload: SpouseInFamilyPayload) => void;
        onfamilyRemoveRequested?: (familyId: string) => void;
        onclose?: () => void;
    };

    let {
        stemma,
        stemmaIndex,
        editMode,
        familyId,
        stubCtx,
        oncreateFamilyFromStub,
        oncreateChildInFamily,
        oncreateSpouseInFamily,
        onfamilyRemoveRequested,
        onclose,
    }: Props = $props();

    let createSelectPersonEl = $state<ReturnType<typeof CreateSelectPerson>>(null);

    type CardMode = "info" | "addChild" | "addSpouse";
    let cardMode = $state<CardMode>("info");
    let selectedPerson = $state<CreateNewPerson | PersonDescription | null>(null);

    const isStub = $derived(stubCtx !== null);

    const family = $derived.by<FamilyDescription | null>(() => {
        if (!familyId || !stemmaIndex) return null;
        return stemmaIndex.family(familyId) ?? null;
    });

    const effectiveParents = $derived.by<string[]>(() => {
        if (isStub && stubCtx) return stubCtx.anchorRole === "parent" ? [stubCtx.anchorPersonId] : [];
        return family?.parents ?? [];
    });

    const effectiveChildren = $derived.by<string[]>(() => {
        if (isStub && stubCtx) return stubCtx.anchorRole === "child" ? [stubCtx.anchorPersonId] : [];
        return family?.children ?? [];
    });

    const canAddSpouse = $derived(effectiveParents.length < 2);
    const canRemoveFamily = $derived(!isStub && family != null && !family.readOnly);

    const familyTitle = $derived.by<string>(() => {
        if (isStub) return $t("v2.stubFamily");
        if (!family || !stemmaIndex) return $t("family.compositionTitle");
        const idx = stemmaIndex;
        const parentNames = family.parents
            .map((id) => idx.person(id))
            .filter((p): p is PersonDescription => p != null)
            .map((p) => personDisplayName(p.name, $t));
        if (parentNames.length === 0) return $t("family.compositionTitle");
        return parentNames.join(" & ");
    });

    function requestRemove() {
        if (!familyId) return;
        const id = familyId;
        onclose?.();
        onfamilyRemoveRequested?.(id);
    }

    function personName(id: string): string {
        const p = stemmaIndex?.person(id);
        return p ? personDisplayName(p.name, $t) : id;
    }

    function startAddChild() {
        selectedPerson = null;
        createSelectPersonEl?.reset();
        cardMode = "addChild";
    }

    function startAddSpouse() {
        selectedPerson = null;
        createSelectPersonEl?.reset();
        cardMode = "addSpouse";
    }

    function confirmAction() {
        if (!selectedPerson) return;

        const personArg = "id" in selectedPerson
            ? ({ type: "ExistingPerson" as const, id: (selectedPerson as PersonDescription).id })
            : (selectedPerson as CreateNewPerson);

        if (isStub && stubCtx) {
            const action = cardMode === "addChild" ? "addChild" : "addSpouse";
            const payload: FamilyFromStubPayload = {
                stubId: stubCtx.stubId,
                anchorPersonId: stubCtx.anchorPersonId,
                anchorRole: stubCtx.anchorRole,
                action,
            };
            if ("id" in personArg) {
                payload.existingPersonId = (personArg as { type: "ExistingPerson"; id: string }).id;
            } else {
                payload.newPerson = personArg as CreateNewPerson;
            }
            oncreateFamilyFromStub?.(payload);
        } else if (familyId) {
            if (cardMode === "addChild") {
                oncreateChildInFamily?.({ familyId, person: personArg });
            } else if (cardMode === "addSpouse") {
                oncreateSpouseInFamily?.({ familyId, person: personArg });
            }
        }
        onclose?.();
    }
</script>

<div>
    {#if cardMode === "info"}
        <div class="family-title">
            <span class="title-text">{familyTitle}</span>
        </div>

        {#if effectiveParents.length > 0}
            <p class="section-label">{$t("family.parents")}</p>
            <ul class="member-list">
                {#each effectiveParents as pid}
                    <li>{personName(pid)}</li>
                {/each}
            </ul>
        {/if}
        {#if effectiveChildren.length > 0}
            <p class="section-label">{$t("family.children")}</p>
            <ul class="member-list">
                {#each effectiveChildren as cid}
                    <li>{personName(cid)}</li>
                {/each}
            </ul>
        {/if}
        {#if effectiveParents.length === 0 && effectiveChildren.length === 0}
            <p class="no-info">{$t("family.noInfo")}</p>
        {/if}

        {#if isStub && editMode}
            <div class="card-actions">
                <button
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    onclick={startAddChild}
                    data-testid="v2-add-child-action"
                >
                    {$t("v2.addChild")}
                </button>
                <button
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    disabled={!canAddSpouse}
                    onclick={startAddSpouse}
                >
                    {$t("v2.addSpouse")}
                </button>
            </div>
        {:else if editMode && canRemoveFamily}
            <div class="card-actions justify-end">
                <button
                    type="button"
                    class="btn btn-sm btn-secondary"
                    onclick={() => onclose?.()}
                >
                    {$t("common.cancel")}
                </button>
                <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    onclick={requestRemove}
                    data-testid="v2-remove-family-action"
                >
                    {$t("common.delete")}
                </button>
            </div>
        {/if}
    {:else}
        <div class="family-title">
            <span class="title-text">
                {cardMode === "addChild" ? $t("v2.addChild") : $t("v2.addSpouse")}
            </span>
        </div>

        <div class="person-picker-wrap">
            <CreateSelectPerson
                bind:this={createSelectPersonEl}
                {stemmaIndex}
                {stemma}
                onselected={(p) => { selectedPerson = p; }}
            />
        </div>

        <div class="card-actions">
            <button type="button" class="btn btn-secondary btn-sm" onclick={() => { cardMode = "info"; }}>
                {$t("common.back")}
            </button>
            <button
                type="button"
                class="btn btn-primary btn-sm ms-auto"
                disabled={!selectedPerson}
                onclick={confirmAction}
                data-testid="v2-family-confirm"
            >
                {$t("common.ok")}
            </button>
        </div>
    {/if}
</div>

<style>
    .family-title {
        margin-bottom: 14px;
        line-height: 1.35;
    }

    .title-text {
        font-weight: 700;
        font-size: 0.95rem;
    }

    .section-label {
        font-size: 0.72rem;
        color: #6c757d;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 12px 0 6px;
        font-weight: 600;
    }

    .member-list {
        list-style: none;
        padding: 0;
        margin: 0 0 4px;
        font-size: 0.92rem;
        line-height: 1.5;
    }

    .member-list li + li {
        margin-top: 4px;
    }

    .no-info {
        color: #6c757d;
        font-style: italic;
        font-size: 0.9rem;
        margin: 8px 0;
    }

    .card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        padding-top: 16px;
        margin-top: 4px;
        border-top: 1px solid #f1f3f5;
    }

    .card-actions.justify-end {
        justify-content: flex-end;
    }

    .person-picker-wrap {
        min-height: 300px;
    }
</style>
