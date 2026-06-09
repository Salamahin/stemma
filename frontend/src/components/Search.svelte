<script lang="ts">
    import type { PersonDescription } from "../model";
    import { t } from "../i18n";
    import { highlightMatches, searchPeople } from "../personSearch";

    type Props = {
        people: PersonDescription[];
        disabled?: boolean;
        onselect?: (id: string) => void;
    };

    let { people, disabled = false, onselect }: Props = $props();

    let query = $state("");
    let activeIndex = $state(-1);
    let focused = $state(false);
    let inputEl = $state<HTMLInputElement | null>(null);
    let blurTimeout: ReturnType<typeof setTimeout>;

    const results = $derived(searchPeople(query, people));
    const hasQuery = $derived(query.trim().length >= 2);
    const showDropdown = $derived(focused && hasQuery);
    const showNoResults = $derived(showDropdown && results.length === 0);

    $effect(() => {
        results;
        activeIndex = -1;
    });

    function lifespan(p: PersonDescription): string {
        const parts = [p.birthDate || "?", p.deathDate].filter(Boolean);
        return parts.length ? parts.join(" – ") : "";
    }

    function selectPerson(id: string) {
        onselect?.(id);
        query = "";
        focused = false;
        inputEl?.blur();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            query = "";
            focused = false;
            inputEl?.blur();
            return;
        }
        if (!showDropdown || results.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % results.length;
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + results.length) % results.length;
        } else if (e.key === "Enter") {
            e.preventDefault();
            const idx = activeIndex >= 0 ? activeIndex : 0;
            selectPerson(results[idx].item.id);
        }
    }

    function handleBlur() {
        blurTimeout = setTimeout(() => {
            focused = false;
        }, 150);
    }

    function handleFocus() {
        clearTimeout(blurTimeout);
        focused = true;
    }

    function clearQuery() {
        query = "";
        inputEl?.focus();
    }
</script>

<div class="search" data-testid="search">
    <i class="bi bi-search search-icon" aria-hidden="true"></i>
    <input
        bind:this={inputEl}
        type="search"
        class="search-input"
        placeholder={$t("search.placeholder")}
        bind:value={query}
        {disabled}
        onkeydown={handleKeydown}
        onblur={handleBlur}
        onfocus={handleFocus}
        aria-label={$t("search.placeholder")}
        data-testid="search-input"
    />
    {#if query.length > 0}
        <button
            type="button"
            class="clear-btn"
            onclick={clearQuery}
            aria-label={$t("common.close")}
            data-testid="search-clear"
        >
            <i class="bi bi-x"></i>
        </button>
    {/if}

    {#if showDropdown}
        <div class="search-dropdown" data-testid="search-dropdown">
            {#if showNoResults}
                <div class="no-results" data-testid="search-no-results">
                    {$t("searchNoResults")}
                </div>
            {:else}
                {#each results as result, i}
                    <button
                        type="button"
                        class="search-row"
                        class:active={i === activeIndex}
                        onmousedown={(e) => { e.preventDefault(); selectPerson(result.item.id); }}
                        data-testid="search-result"
                    >
                        <span class="row-name">{@html highlightMatches(result.item.name, result.matchedIndices)}</span>
                        {#if lifespan(result.item)}
                            <span class="row-meta">{lifespan(result.item)}</span>
                        {/if}
                    </button>
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    .search {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        padding: 6px 10px;
        position: relative;
        width: min(320px, calc(100vw - 200px));
        min-width: 200px;
    }

    .search-icon {
        color: #6c757d;
        font-size: 0.95rem;
        flex-shrink: 0;
    }

    .search-input {
        flex: 1 1 auto;
        min-width: 0;
        border: none;
        outline: none;
        background: transparent;
        font-size: 0.875rem;
        color: #212529;
        padding: 2px 0;
    }

    .search-input::placeholder {
        color: #adb5bd;
    }

    .search-input::-webkit-search-cancel-button {
        display: none;
    }

    .clear-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: #6c757d;
        cursor: pointer;
        flex-shrink: 0;
        font-size: 0.95rem;
    }

    .clear-btn:hover {
        background: #e9ecef;
        color: #212529;
    }

    .search-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        max-height: 320px;
        overflow-y: auto;
        z-index: 1000;
        padding: 4px 0;
    }

    .search-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        background: none;
        border: none;
        text-align: left;
        font-size: 0.875rem;
        color: #212529;
        cursor: pointer;
    }

    .search-row:hover,
    .search-row.active {
        background: #f1f7ff;
    }

    .row-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .row-name :global(b) {
        font-weight: 700;
        color: #0d6efd;
    }

    .row-meta {
        color: #6c757d;
        font-size: 0.8rem;
        flex-shrink: 0;
    }

    .no-results {
        padding: 10px 12px;
        color: #6c757d;
        font-size: 0.85rem;
        text-align: center;
    }
</style>
