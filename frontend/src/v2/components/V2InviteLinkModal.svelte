<script lang="ts">
    import { t } from "../../i18n";
    import V2Modal from "./V2Modal.svelte";

    let open = $state(false);
    let link = $state("");
    let copied = $state(false);

    export function show(invitationLink: string) {
        link = invitationLink;
        copied = false;
        open = true;
    }

    export function close() {
        open = false;
    }

    async function copy() {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            copied = true;
            setTimeout(() => (copied = false), 1500);
        } catch {}
    }
</script>

<V2Modal
    {open}
    title={$t("v2.shareLinkTitle")}
    size="md"
    onclose={close}
    testid="v2-invite-link-modal"
>
    {#snippet body()}
        <p class="hint">{$t("v2.shareLinkHint")}</p>
        <input
            type="text"
            class="form-control link-input"
            readonly
            value={link}
            data-testid="v2-invite-link-value"
        />
    {/snippet}

    {#snippet footer()}
        <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.close")}</button>
        <button
            type="button"
            class="btn btn-primary"
            onclick={copy}
            disabled={!link}
            data-testid="v2-invite-link-copy"
        >
            {copied ? $t("v2.linkCopied") : $t("v2.copyLink")}
        </button>
    {/snippet}
</V2Modal>

<style>
    .hint {
        margin: 0 0 10px;
        font-size: var(--v2-fs-hint);
        color: var(--v2-text-muted);
    }

    .link-input {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: var(--v2-fs-label);
    }
</style>
