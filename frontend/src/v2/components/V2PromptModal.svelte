<script lang="ts">
    import { t } from "../../i18n";
    import V2Modal from "./V2Modal.svelte";

    type Props = {
        oncommit?: (value: string) => void;
    };

    let { oncommit }: Props = $props();

    let open = $state(false);
    let inputEl = $state<HTMLInputElement | null>(null);
    let value = $state("");

    let title = $state("");
    let label = $state("");
    let confirmLabel = $state("");
    let placeholder = $state("");
    let testid = $state<string | undefined>(undefined);

    export function prompt(opts: {
        title: string;
        label: string;
        confirmLabel: string;
        initial?: string;
        placeholder?: string;
        testid?: string;
    }) {
        title = opts.title;
        label = opts.label;
        confirmLabel = opts.confirmLabel;
        placeholder = opts.placeholder ?? "";
        testid = opts.testid;
        value = opts.initial ?? "";
        open = true;
        setTimeout(() => {
            inputEl?.focus();
            inputEl?.select();
        }, 60);
    }

    function close() {
        open = false;
    }

    function commit() {
        const v = value.trim();
        if (!v) return;
        close();
        oncommit?.(v);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            commit();
        }
    }
</script>

<V2Modal {open} {title} size="sm" onclose={close} testid={testid}>
    {#snippet body()}
        <label for="v2-prompt-input" class="prompt-label">{label}</label>
        <input
            id="v2-prompt-input"
            class="form-control"
            bind:this={inputEl}
            bind:value
            onkeydown={handleKeydown}
            placeholder={placeholder}
            data-testid="v2-prompt-input"
        />
    {/snippet}

    {#snippet footer()}
        <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.cancel")}</button>
        <button
            type="button"
            class="btn btn-primary"
            onclick={commit}
            disabled={!value.trim()}
            data-testid="v2-prompt-confirm"
        >
            {confirmLabel}
        </button>
    {/snippet}
</V2Modal>

<style>
    .prompt-label {
        display: block;
        margin: 4px 0 6px;
        font-size: 0.85rem;
        font-weight: 500;
        color: #495057;
    }
</style>
