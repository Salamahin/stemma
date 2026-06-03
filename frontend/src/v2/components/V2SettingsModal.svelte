<script lang="ts">
    import { t } from "../../i18n";
    import type { Settings } from "../../model";
    import { DEFAULT_SETTINGS, ViewMode } from "../../model";
    import V2Modal from "./V2Modal.svelte";

    type Props = {
        onsettingsChanged?: (settings: Settings) => void;
    };

    let { onsettingsChanged }: Props = $props();

    let open = $state(false);
    let viewMode = $state<ViewMode>(DEFAULT_SETTINGS.viewMode);

    export function show() {
        open = true;
    }

    function close() {
        open = false;
    }

    function save() {
        onsettingsChanged?.({ viewMode });
        close();
    }
</script>

<V2Modal {open} title={$t("settings.title")} size="sm" onclose={close} testid="v2-settings-modal">
    {#snippet body()}
        <div class="option" role="radio" tabindex="0" aria-checked={viewMode === ViewMode.ALL} onclick={() => (viewMode = ViewMode.ALL)} onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); viewMode = ViewMode.ALL; } }}>
            <span class="dot" class:active={viewMode === ViewMode.ALL}></span>
            <span class="label">{$t("settings.showAll")}</span>
        </div>
        <div class="option" role="radio" tabindex="0" aria-checked={viewMode === ViewMode.EDITABLE_ONLY} onclick={() => (viewMode = ViewMode.EDITABLE_ONLY)} onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); viewMode = ViewMode.EDITABLE_ONLY; } }}>
            <span class="dot" class:active={viewMode === ViewMode.EDITABLE_ONLY}></span>
            <span class="label">{$t("settings.showEditableOnly")}</span>
        </div>
    {/snippet}

    {#snippet footer()}
        <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.cancel")}</button>
        <button type="button" class="btn btn-primary" onclick={save} data-testid="v2-settings-save">{$t("common.save")}</button>
    {/snippet}
</V2Modal>

<style>
    .option {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.12s ease;
    }

    .option:hover {
        background: #f8f9fa;
    }

    .option + .option {
        margin-top: 2px;
    }

    .dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid #adb5bd;
        flex-shrink: 0;
        transition: border-color 0.12s ease;
        position: relative;
    }

    .dot.active {
        border-color: #0d6efd;
    }

    .dot.active::after {
        content: "";
        position: absolute;
        inset: 2px;
        border-radius: 50%;
        background: #0d6efd;
    }

    .label {
        font-size: var(--v2-fs-body);
        color: var(--v2-text-primary);
    }
</style>
