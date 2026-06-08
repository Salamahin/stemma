<script lang="ts">
    import { t } from "../../i18n";
    import V3Modal from "./V3Modal.svelte";

    type Props = {
        oncreate?: (payload: { personId: string; email: string }) => void;
    };

    let { oncreate }: Props = $props();

    let open = $state(false);
    let personId = $state("");
    let personName = $state("");
    let email = $state("");

    const submitDisabled = $derived(!email.trim());

    export function show(args: { personId: string; name: string }) {
        personId = args.personId;
        personName = args.name;
        email = "";
        open = true;
    }

    export function close() {
        open = false;
    }

    export function dismiss() {
        close();
    }

    function handleCreate() {
        const value = email.trim();
        if (!value || !personId) return;
        oncreate?.({ personId, email: value });
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleCreate();
        }
    }
</script>

<V3Modal
    {open}
    title={$t("v2.shareTitle", { name: personName })}
    size="md"
    onclose={close}
    testid="v3-share-access-modal"
>
    {#snippet body()}
        <label for="v3-share-access-email" class="field-label">{$t("v2.shareEmailLabel")}</label>
        <input
            id="v3-share-access-email"
            type="email"
            class="form-control"
            placeholder="name@gmail.com"
            bind:value={email}
            onkeydown={handleKeydown}
            data-testid="v3-share-access-email"
        />
        <p class="hint">{$t("v2.shareEmailHint")}</p>
    {/snippet}

    {#snippet footer()}
        <button
            type="button"
            class="btn btn-secondary"
            onclick={close}
            data-testid="v3-share-access-cancel"
        >{$t("common.cancel")}</button>
        <button
            type="button"
            class="btn btn-primary"
            disabled={submitDisabled}
            onclick={handleCreate}
            data-testid="v3-share-access-create"
        >{$t("v2.shareCreateLink")}</button>
    {/snippet}
</V3Modal>

<style>
    .field-label {
        display: block;
        margin: 0 0 6px;
        font-size: var(--v3-fs-label);
        color: var(--v3-text-secondary);
        font-weight: var(--v3-fw-label);
    }

    .hint {
        margin: 8px 0 0;
        font-size: var(--v3-fs-hint);
        color: var(--v3-text-muted);
    }
</style>
