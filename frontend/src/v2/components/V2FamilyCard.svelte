<script lang="ts">
    import type { FamilyDescription, PersonDescription } from "../../model";
    import type { StemmaIndex } from "../../stemmaIndex";
    import { t } from "../../i18n";
    import { personDisplayName } from "../../personDisplayName";

    type Props = {
        stemmaIndex: StemmaIndex | null;
        editMode: boolean;
        familyId: string | null;
        onfamilyRemoveRequested?: (familyId: string) => void;
        onclose?: () => void;
    };

    let {
        stemmaIndex,
        editMode,
        familyId,
        onfamilyRemoveRequested,
        onclose,
    }: Props = $props();

    const family = $derived.by<FamilyDescription | null>(() => {
        if (!familyId || !stemmaIndex) return null;
        return stemmaIndex.family(familyId) ?? null;
    });

    const canRemoveFamily = $derived(family != null && !family.readOnly);

    const familyTitle = $derived.by<string>(() => {
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
</script>

<div>
    <div class="family-title">
        <span class="title-text">{familyTitle}</span>
    </div>

    {#if family && family.parents.length > 0}
        <p class="section-label">{$t("family.parents")}</p>
        <ul class="member-list">
            {#each family.parents as pid}
                <li>{personName(pid)}</li>
            {/each}
        </ul>
    {/if}
    {#if family && family.children.length > 0}
        <p class="section-label">{$t("family.children")}</p>
        <ul class="member-list">
            {#each family.children as cid}
                <li>{personName(cid)}</li>
            {/each}
        </ul>
    {/if}
    {#if !family || (family.parents.length === 0 && family.children.length === 0)}
        <p class="no-info">{$t("family.noInfo")}</p>
    {/if}

    {#if editMode && canRemoveFamily}
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
</style>
