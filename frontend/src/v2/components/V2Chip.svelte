<script lang="ts">
    import type { StemmaDescription } from "../../model";
    import { locale, t } from "../../i18n";

    type Props = {
        ownedStemmas: StemmaDescription[];
        currentStemmaId: string | null;
        disabled: boolean;
        onstemmaSelect?: (id: string) => void;
        onstemmaAddNew?: () => void;
        onstemmaRename?: (s: StemmaDescription) => void;
        onstemmaClone?: (s: StemmaDescription) => void;
        onstemmaRemove?: (s: StemmaDescription) => void;
    };

    let {
        ownedStemmas,
        currentStemmaId,
        disabled,
        onstemmaSelect,
        onstemmaAddNew,
        onstemmaRename,
        onstemmaClone,
        onstemmaRemove,
    }: Props = $props();

    const currentStemma = $derived(ownedStemmas.find((s) => s.id === currentStemmaId));
    let dropdownOpen = $state(false);

    function toggleDropdown() {
        if (!disabled) dropdownOpen = !dropdownOpen;
    }

    function selectStemma(id: string) {
        dropdownOpen = false;
        onstemmaSelect?.(id);
    }

    function trigger(action: ((s: StemmaDescription) => void) | undefined, s: StemmaDescription, e: MouseEvent) {
        e.stopPropagation();
        dropdownOpen = false;
        action?.(s);
    }

    function addNew() {
        dropdownOpen = false;
        onstemmaAddNew?.();
    }

    function handleLangToggle() {
        locale.set($locale === "en" ? "ru" : "en");
    }
</script>

<div class="v2-chip">
    <div class="stemma-selector">
        <button
            type="button"
            class="stemma-btn"
            onclick={toggleDropdown}
            disabled={disabled}
            aria-expanded={dropdownOpen}
            data-testid="v2-chip-stemma-btn"
        >
            <span class="stemma-name">{currentStemma?.name ?? ""}</span>
            <i class="bi bi-chevron-down chevron" class:rotated={dropdownOpen}></i>
        </button>
        {#if dropdownOpen}
            <div class="stemma-dropdown" data-testid="v2-chip-dropdown">
                {#each ownedStemmas as s}
                    <div
                        class="stemma-row"
                        class:active={s.id === currentStemmaId}
                        role="button"
                        tabindex="0"
                        onclick={() => selectStemma(s.id)}
                        onkeydown={(e) => { if (e.key === "Enter") selectStemma(s.id); }}
                    >
                        <span class="row-name">{s.name}</span>
                        <div
                            class="row-actions"
                            onclick={(e) => e.stopPropagation()}
                            onkeydown={(e) => e.stopPropagation()}
                            role="toolbar"
                            tabindex="-1"
                        >
                            <button
                                type="button"
                                class="row-btn"
                                aria-label={$t("v2.renameStemma")}
                                title={$t("v2.renameStemma")}
                                onclick={(e) => trigger(onstemmaRename, s, e)}
                                data-testid="v2-chip-rename"
                            ><i class="bi bi-pencil"></i></button>
                            <button
                                type="button"
                                class="row-btn"
                                aria-label={$t("v2.cloneStemma")}
                                title={$t("v2.cloneStemma")}
                                onclick={(e) => trigger(onstemmaClone, s, e)}
                                data-testid="v2-chip-clone"
                            ><i class="bi bi-copy"></i></button>
                            {#if s.removable && s.id !== currentStemmaId}
                                <button
                                    type="button"
                                    class="row-btn danger"
                                    aria-label={$t("v2.deleteStemma")}
                                    title={$t("v2.deleteStemma")}
                                    onclick={(e) => trigger(onstemmaRemove, s, e)}
                                    data-testid="v2-chip-remove"
                                ><i class="bi bi-trash"></i></button>
                            {:else}
                                <span class="row-btn placeholder" aria-hidden="true"></span>
                            {/if}
                        </div>
                    </div>
                {/each}
                <div class="dropdown-divider"></div>
                <button
                    type="button"
                    class="add-stemma"
                    onclick={addNew}
                    data-testid="v2-chip-add-stemma"
                >
                    <i class="bi bi-plus-lg"></i> {$t("v2.newStemma")}
                </button>
            </div>
        {/if}
    </div>
    <div class="divider"></div>

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
        max-width: 200px;
    }

    .stemma-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .stemma-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 180px;
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
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        min-width: 240px;
        z-index: 1000;
        overflow: hidden;
        padding: 4px 0;
    }

    .stemma-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        font-size: 0.875rem;
        cursor: pointer;
        color: #212529;
    }

    .stemma-row:hover {
        background: #f8f9fa;
    }

    .stemma-row.active .row-name {
        color: #0d6efd;
        font-weight: 600;
    }

    .row-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .row-actions {
        display: inline-flex;
        gap: 2px;
        flex-shrink: 0;
    }

    .row-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: #6c757d;
        cursor: pointer;
        transition: background-color 0.12s ease, color 0.12s ease;
        font-size: 0.8rem;
    }

    .row-btn:hover {
        background: #e9ecef;
        color: #212529;
    }

    .row-btn.danger:hover {
        background: #f8d7da;
        color: #dc3545;
    }

    .row-btn.placeholder {
        visibility: hidden;
        pointer-events: none;
        cursor: default;
    }

    .dropdown-divider {
        height: 1px;
        background: #e9ecef;
        margin: 4px 0;
    }

    .add-stemma {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        background: none;
        border: none;
        text-align: left;
        font-size: 0.875rem;
        cursor: pointer;
        color: #0d6efd;
        font-weight: 500;
    }

    .add-stemma:hover {
        background: #f1f7ff;
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
