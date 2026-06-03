<script lang="ts">
    import type { StemmaDescription } from "../../model";
    import { locale, t } from "../../i18n";

    type Props = {
        ownedStemmas: StemmaDescription[];
        currentStemmaId: string | null;
        disabled: boolean;
        onstemmaSelect?: (id: string) => void;
    };

    let { ownedStemmas, currentStemmaId, disabled, onstemmaSelect }: Props = $props();

    const currentStemma = $derived(ownedStemmas.find((s) => s.id === currentStemmaId));
    let dropdownOpen = $state(false);

    function toggleDropdown() {
        if (!disabled) dropdownOpen = !dropdownOpen;
    }

    function selectStemma(id: string) {
        dropdownOpen = false;
        onstemmaSelect?.(id);
    }

    function handleLangToggle() {
        locale.set($locale === "en" ? "ru" : "en");
    }
</script>

<div class="v2-chip">
    {#if ownedStemmas.length > 1}
        <div class="stemma-selector">
            <button
                type="button"
                class="stemma-btn"
                onclick={toggleDropdown}
                disabled={disabled}
                aria-expanded={dropdownOpen}
            >
                <span class="stemma-name">{currentStemma?.name ?? ""}</span>
                <i class="bi bi-chevron-down chevron" class:rotated={dropdownOpen}></i>
            </button>
            {#if dropdownOpen}
                <div class="stemma-dropdown">
                    {#each ownedStemmas as s}
                        <button
                            type="button"
                            class="stemma-option {s.id === currentStemmaId ? 'active' : ''}"
                            onclick={() => selectStemma(s.id)}
                        >{s.name}</button>
                    {/each}
                </div>
            {/if}
        </div>
        <div class="divider"></div>
    {/if}

    <button
        type="button"
        class="lang-btn"
        aria-label={$t("nav.language")}
        onclick={handleLangToggle}
    >
        {$locale === "en" ? "RU" : "EN"}
    </button>
</div>

<style>
    .v2-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        padding: 6px 10px;
        position: relative;
    }

    .stemma-selector {
        position: relative;
    }

    .stemma-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        padding: 0 4px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        color: #212529;
        white-space: nowrap;
        max-width: 160px;
    }

    .stemma-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .stemma-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 140px;
    }

    .chevron {
        font-size: 0.7rem;
        transition: transform 0.15s ease;
        flex-shrink: 0;
    }

    .chevron.rotated {
        transform: rotate(180deg);
    }

    .stemma-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        min-width: 180px;
        z-index: 1000;
        overflow: hidden;
    }

    .stemma-option {
        display: block;
        width: 100%;
        padding: 8px 14px;
        background: none;
        border: none;
        text-align: left;
        font-size: 0.875rem;
        cursor: pointer;
        color: #212529;
    }

    .stemma-option:hover {
        background: #f8f9fa;
    }

    .stemma-option.active {
        font-weight: 600;
        color: #0d6efd;
    }

    .divider {
        width: 1px;
        height: 16px;
        background: #dee2e6;
        margin: 0 2px;
    }

    .lang-btn {
        background: none;
        border: none;
        padding: 0 4px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        color: #6c757d;
        letter-spacing: 0.05em;
    }

    .lang-btn:hover {
        color: #212529;
    }
</style>
