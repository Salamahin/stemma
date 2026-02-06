<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import fuzzysort from "fuzzysort";
    import type { PersonDescription } from "../../model";

    export let people: PersonDescription[] = [];
    export let disabled: boolean = false;

    const dispatch = createEventDispatcher();

    let query = "";
    let activeIndex = -1;
    let showDropdown = false;
    let blurTimeout: ReturnType<typeof setTimeout>;

    $: results = query.length >= 2
        ? fuzzysort.go(query, people, { key: "name", limit: 8 })
        : [];

    $: if (results.length > 0 && query.length >= 2) {
        showDropdown = true;
        activeIndex = -1;
    } else {
        showDropdown = false;
    }

    function lifespan(p: PersonDescription): string {
        const parts = [p.birthDate || "?", p.deathDate].filter(Boolean);
        return parts.length ? parts.join(" – ") : "";
    }

    function selectPerson(id: string) {
        dispatch("select", id);
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
                selectPerson(results[activeIndex].obj.id);
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
        placeholder="Быстрый поиск"
        bind:value={query}
        {disabled}
        on:keydown={handleKeydown}
        on:blur={handleBlur}
        on:focus={handleFocus}
    />
    {#if showDropdown && results.length > 0}
        <ul class="dropdown-menu show w-100" style="max-height: 320px; overflow-y: auto">
            {#each results as result, i}
                <li>
                    <button
                        class="dropdown-item {i === activeIndex ? 'active' : ''}"
                        type="button"
                        on:mousedown|preventDefault={() => selectPerson(result.obj.id)}
                    >
                        <span>{@html fuzzysort.highlight(result, '<b>', '</b>')}</span>
                        {#if lifespan(result.obj)}
                            <small class="text-muted ms-2">{lifespan(result.obj)}</small>
                        {/if}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>
