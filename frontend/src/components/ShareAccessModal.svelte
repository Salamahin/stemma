<script lang="ts">
    import { t } from "../i18n";
    import Modal from "./Modal.svelte";

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

<Modal
    {open}
    title={$t("shareTitle", { name: personName })}
    size="md"
    onclose={close}
    testid="share-access-modal"
>
    {#snippet body()}
        <label for="share-access-email" class="field-label">{$t("shareEmailLabel")}</label>
        <input
            id="share-access-email"
            type="email"
            class="form-control"
            placeholder="name@gmail.com"
            bind:value={email}
            onkeydown={handleKeydown}
            data-testid="share-access-email"
        />
        <p class="hint">{$t("shareEmailHint")}</p>
    {/snippet}

    {#snippet footer()}
        <button
            type="button"
            class="btn btn-secondary"
            onclick={close}
            data-testid="share-access-cancel"
        >{$t("common.cancel")}</button>
        <button
            type="button"
            class="btn btn-primary"
            disabled={submitDisabled}
            onclick={handleCreate}
            data-testid="share-access-create"
        >{$t("shareCreateLink")}</button>
    {/snippet}
</Modal>

<style>
    .field-label {
        display: block;
        margin: 0 0 6px;
        font-size: var(---fs-label);
        color: var(---text-secondary);
        font-weight: var(---fw-label);
    }

    .hint {
        margin: 8px 0 0;
        font-size: var(---fs-hint);
        color: var(---text-muted);
    }
</style>
