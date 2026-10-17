<script lang="ts">
    import type { PersonDescription } from "../model";
    import { locale, t } from "../i18n";
    import { formatPartialDate } from "../partialDate";
    import { searchPeople } from "../personSearch";

    /** Picks someone already in the tree (the ghosts link them instead of creating a namesake). */
    type Props = {
        candidates: ReadonlyArray<PersonDescription>;
        onpick: (personId: string) => void;
    };

    let { candidates, onpick }: Props = $props();

    let query = $state("");
    const results = $derived(searchPeople(query, candidates, 20));

    function lifespan(p: PersonDescription): string {
        const parts = [formatPartialDate(p.birthDate, $locale) || "?", formatPartialDate(p.deathDate, $locale)].filter(Boolean);
        return parts.length ? parts.join(" – ") : "";
    }

    function focusOnMount(el: HTMLInputElement) {
        el.focus();
    }
</script>

<div class="picker" data-testid="existing-person-picker">
    <input
        class="form-control"
        type="search"
        placeholder={$t("pickExistingPlaceholder")}
        bind:value={query}
        use:focusOnMount
        data-testid="existing-person-query"
    />
    {#if query.trim().length > 0 && results.length === 0}
        <p class="hint">{$t("pickExistingNone")}</p>
    {:else if results.length > 0}
        <ul class="results">
            {#each results as r (r.item.id)}
                <li>
                    <button type="button" class="row-btn" onclick={() => onpick(r.item.id)} data-testid="existing-person-option">
                        <span class="row-name">{r.item.name}</span>
                        {#if lifespan(r.item)}<span class="row-meta">{lifespan(r.item)}</span>{/if}
                    </button>
                </li>
            {/each}
        </ul>
    {:else}
        <p class="hint">{$t("pickExistingHint")}</p>
    {/if}
</div>

<style>
    .picker {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 240px;
    }
    .results {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 50vh;
        overflow-y: auto;
    }
    .row-btn {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        padding: 8px 10px;
        border: none;
        border-radius: 8px;
        background: none;
        text-align: left;
        cursor: pointer;
    }
    .row-btn:hover,
    .row-btn:focus-visible {
        background: #f1f3f5;
    }
    .row-meta {
        color: #6c757d;
        font-size: 0.85rem;
        white-space: nowrap;
    }
    .hint {
        color: #6c757d;
        font-size: 0.9rem;
        margin: 0;
    }
</style>
