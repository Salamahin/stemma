<script lang="ts">
    import { t } from "../../i18n";
    import V3Modal from "./V3Modal.svelte";

    type Props = {
        onconfirm?: () => void;
    };

    let { onconfirm }: Props = $props();

    let open = $state(false);
    let title = $state("");
    let message = $state<string | null>(null);
    let confirmLabel = $state("");
    let danger = $state(false);
    let testid = $state<string | undefined>(undefined);
    let pendingConfirm: (() => void) | null = null;

    export function ask(opts: {
        title: string;
        message?: string;
        confirmLabel: string;
        danger?: boolean;
        testid?: string;
        onaccept: () => void;
    }) {
        title = opts.title;
        message = opts.message ?? null;
        confirmLabel = opts.confirmLabel;
        danger = opts.danger ?? false;
        testid = opts.testid;
        pendingConfirm = opts.onaccept;
        open = true;
    }

    function close() {
        open = false;
        pendingConfirm = null;
    }

    function accept() {
        const cb = pendingConfirm;
        open = false;
        pendingConfirm = null;
        cb?.();
        onconfirm?.();
    }
</script>

<V3Modal {open} {title} size="sm" onclose={close} testid={testid}>
    {#snippet body()}
        {#if message}
            <p class="confirm-msg">{message}</p>
        {/if}
    {/snippet}

    {#snippet footer()}
        <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.cancel")}</button>
        <button
            type="button"
            class={danger ? "btn btn-danger" : "btn btn-primary"}
            onclick={accept}
            data-testid="v3-confirm-accept"
        >
            {confirmLabel}
        </button>
    {/snippet}
</V3Modal>

<style>
    .confirm-msg {
        margin: 0;
        color: var(--v3-text-secondary);
        font-size: var(--v3-fs-body);
    }
</style>
