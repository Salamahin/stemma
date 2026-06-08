<script lang="ts">
    import { t } from "../../i18n";
    import V3Modal from "./V3Modal.svelte";

    let open = $state(false);
    let inputEl = $state<HTMLInputElement | null>(null);
    let value = $state("");

    let title = $state("");
    let label = $state("");
    let confirmLabel = $state("");
    let placeholder = $state("");
    let testid = $state<string | undefined>(undefined);
    let inputTestid = $state<string>("v3-prompt-input");
    let confirmTestid = $state<string>("v3-prompt-confirm");
    let pendingAccept: ((value: string) => void) | null = null;

    export function prompt(opts: {
        title: string;
        label: string;
        confirmLabel: string;
        initial?: string;
        placeholder?: string;
        testid?: string;
        inputTestid?: string;
        confirmTestid?: string;
        onaccept: (value: string) => void;
    }) {
        title = opts.title;
        label = opts.label;
        confirmLabel = opts.confirmLabel;
        placeholder = opts.placeholder ?? "";
        testid = opts.testid;
        inputTestid = opts.inputTestid ?? "v3-prompt-input";
        confirmTestid = opts.confirmTestid ?? "v3-prompt-confirm";
        value = opts.initial ?? "";
        pendingAccept = opts.onaccept;
        open = true;
        setTimeout(() => {
            inputEl?.focus();
            inputEl?.select();
        }, 60);
    }

    function close() {
        open = false;
        pendingAccept = null;
    }

    function commit() {
        const v = value.trim();
        if (!v) return;
        const cb = pendingAccept;
        open = false;
        pendingAccept = null;
        cb?.(v);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            commit();
        }
    }
</script>

<V3Modal {open} {title} size="sm" onclose={close} testid={testid}>
    {#snippet body()}
        <label for="v3-prompt-input" class="prompt-label">{label}</label>
        <input
            id="v3-prompt-input"
            class="form-control"
            bind:this={inputEl}
            bind:value
            onkeydown={handleKeydown}
            placeholder={placeholder}
            data-testid={inputTestid}
        />
    {/snippet}

    {#snippet footer()}
        <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.cancel")}</button>
        <button
            type="button"
            class="btn btn-primary"
            onclick={commit}
            disabled={!value.trim()}
            data-testid={confirmTestid}
        >
            {confirmLabel}
        </button>
    {/snippet}
</V3Modal>

<style>
    .prompt-label {
        display: block;
        margin: 4px 0 6px;
        font-size: var(--v3-fs-label);
        font-weight: var(--v3-fw-label);
        color: var(--v3-text-secondary);
    }
</style>
