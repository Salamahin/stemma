<script lang="ts">
    import type { PersonDescription } from "../../model";
    import { t } from "../../i18n";
    import { highlightMatches, searchPeople } from "../../personSearch";

    type Props = {
        people?: PersonDescription[];
        disabled?: boolean;
        onselect?: (id: string) => void;
    };

    let { people = [], disabled = false, onselect }: Props = $props();

    let query = $state("");
    let activeIndex = $state(-1);
    let showDropdown = $state(false);
    let blurTimeout: ReturnType<typeof setTimeout>;

    const results = $derived(searchPeople(query, people));

    $effect(() => {
        showDropdown = results.length > 0 && query.length >= 2;
        activeIndex = -1;
    });

    function lifespan(p: PersonDescription): string {
        const parts = [p.birthDate || "?", p.deathDate].filter(Boolean);
        return parts.length ? parts.join(" – ") : "";
    }

    function selectPerson(id: string) {
        onselect?.(id);
        query = "";
        showDropdown = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (!showDropdown) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % results.length;
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + results.length) % results.length;
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < results.length) {
                selectPerson(results[activeIndex].item.id);
            }
        } else if (e.key === "Escape") {
            showDropdown = false;
        }
    }

    function handleBlur() {
        blurTimeout = setTimeout(() => {
            showDropdown = false;
        }, 150);
    }

    function handleFocus() {
        clearTimeout(blurTimeout);
        if (results.length > 0 && query.length >= 2) {
            showDropdown = true;
        }
    }
</script>

<div class="position-relative" style="min-width: 350px">
    <input
        type="search"
        class="form-control"
        placeholder={$t("search.placeholder")}
        bind:value={query}
        {disabled}
        onkeydown={handleKeydown}
        onblur={handleBlur}
        onfocus={handleFocus}
    />
    {#if showDropdown && results.length > 0}
        <ul class="dropdown-menu show w-100" style="max-height: 320px; overflow-y: auto">
            {#each results as result, i}
                <li>
                    <button
                        class="dropdown-item {i === activeIndex ? 'active' : ''}"
                        type="button"
                        onmousedown={(e) => { e.preventDefault(); selectPerson(result.item.id); }}
                    >
                        <span>{@html highlightMatches(result.item.name, result.matchedIndices)}</span>
                        {#if lifespan(result.item)}
                            <small class="text-muted ms-2">{lifespan(result.item)}</small>
                        {/if}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>
