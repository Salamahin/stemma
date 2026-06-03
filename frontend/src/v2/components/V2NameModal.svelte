<script lang="ts">
    import { t } from "../../i18n";
    import V2Modal from "./V2Modal.svelte";

    type Props = {
        onconfirm?: (name: string) => void;
    };

    let { onconfirm }: Props = $props();

    let open = $state(false);
    let inputEl = $state<HTMLInputElement | null>(null);
    let value = $state("");

    export function prompt() {
        value = "";
        open = true;
        setTimeout(() => inputEl?.focus(), 60);
    }

    function close() {
        open = false;
    }

    function confirm() {
        const name = value.trim();
        if (!name) return;
        open = false;
        onconfirm?.(name);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            confirm();
        }
    }
</script>

<V2Modal {open} title={$t("v2.addPerson")} size="sm" onclose={close} testid="v2-name-modal">
    {#snippet body()}
        <label for="v2-name-input" class="field-label">{$t("v2.namePlaceholder")}</label>
        <input
            id="v2-name-input"
            class="form-control"
            placeholder={$t("v2.namePlaceholder")}
            bind:this={inputEl}
            bind:value
            onkeydown={handleKeydown}
            data-testid="v2-name-input"
        />
    {/snippet}

    {#snippet footer()}
        <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.cancel")}</button>
        <button
            type="button"
            class="btn btn-primary"
            onclick={confirm}
            disabled={!value.trim()}
            data-testid="v2-name-confirm"
        >
            {$t("common.add")}
        </button>
    {/snippet}
</V2Modal>

<style>
    .field-label {
        display: block;
        margin: 4px 0 6px;
        font-size: var(--v2-fs-label);
        font-weight: var(--v2-fw-label);
        color: var(--v2-text-secondary);
    }
</style>
