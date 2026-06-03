<script lang="ts">
    import type { PersonDescription } from "../../model";
    import { t } from "../../i18n";
    import { renderBioMarkdown } from "../../bioMarkdown";
    import { personDisplayName } from "../../personDisplayName";

    type Props = {
        person: PersonDescription;
        editMode: boolean;
        onfamilyStubRequested?: (anchorPersonId: string, anchorRole: "parent" | "child") => void;
        onpersonEditRequested?: (personId: string) => void;
        onshareRequested?: (personId: string) => void;
        onclose?: () => void;
    };

    let { person, editMode, onfamilyStubRequested, onpersonEditRequested, onshareRequested, onclose }: Props = $props();

    const bioHtml = $derived(renderBioMarkdown(person.bio));
    const displayName = $derived(personDisplayName(person.name, $t));

    function requestDescendantFamily() {
        const id = person.id;
        onclose?.();
        onfamilyStubRequested?.(id, "parent");
    }

    function requestAncestorFamily() {
        const id = person.id;
        onclose?.();
        onfamilyStubRequested?.(id, "child");
    }

    function requestEdit() {
        const id = person.id;
        onclose?.();
        onpersonEditRequested?.(id);
    }

    function requestShare() {
        const id = person.id;
        onclose?.();
        onshareRequested?.(id);
    }
</script>

<div>
    <div class="person-header">
        <h6 class="person-name">{displayName}</h6>
        {#if person.birthDate || person.deathDate}
            <p class="person-dates">{person.birthDate ?? "?"} — {person.deathDate ?? "?"}</p>
        {/if}
    </div>

    {#if bioHtml}
        <div class="bio-preview">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html bioHtml}
        </div>
    {/if}

    <div class="person-actions">
        {#if editMode && !person.readOnly}
            <button
                type="button"
                class="btn btn-outline-primary btn-sm action-btn"
                onclick={requestDescendantFamily}
                data-testid="v2-add-family-action"
            >
                {$t("v2.addFamily")}
            </button>
            <button
                type="button"
                class="btn btn-outline-primary btn-sm action-btn"
                onclick={requestAncestorFamily}
            >
                {$t("v2.addAncestor")}
            </button>
            <button
                type="button"
                class="btn btn-outline-primary btn-sm action-btn ms-auto"
                onclick={requestEdit}
                aria-label={$t("person.bioEdit")}
            >
                <i class="bi bi-pencil"></i>
            </button>
            <button
                type="button"
                class="btn btn-primary btn-sm action-btn"
                onclick={requestShare}
                data-testid="v2-share-action"
            >
                <i class="bi bi-share me-1"></i>{$t("v2.share")}
            </button>
        {:else if !person.readOnly}
            <button
                type="button"
                class="btn btn-primary btn-sm action-btn ms-auto"
                onclick={requestShare}
                data-testid="v2-share-action"
            >
                <i class="bi bi-share me-1"></i>{$t("v2.share")}
            </button>
        {/if}
    </div>
</div>

<style>
    .person-header {
        margin-bottom: 8px;
    }

    .person-name {
        margin: 0 0 2px;
        font-weight: 700;
        font-size: 1rem;
    }

    .person-dates {
        margin: 0;
        font-size: 0.82rem;
        color: #6c757d;
    }

    .bio-preview {
        font-size: 0.88rem;
        max-height: 180px;
        overflow-y: auto;
        margin-bottom: 8px;
        color: #495057;
    }

    .person-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        padding-top: 8px;
    }

    .action-btn {
        flex-shrink: 0;
    }
</style>
