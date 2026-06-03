<script lang="ts">
    import { t } from "../../i18n";
    import V2Modal from "./V2Modal.svelte";

    export type V2ShareRequest = { personId: string; email: string };

    type Props = {
        oninvite?: (payload: V2ShareRequest) => void;
    };

    let { oninvite }: Props = $props();

    let open = $state(false);
    let personId = $state<string | null>(null);
    let personName = $state("");
    let email = $state("");
    let emailEl = $state<HTMLInputElement | null>(null);

    export function show(payload: { personId: string; personName: string }) {
        personId = payload.personId;
        personName = payload.personName;
        email = "";
        open = true;
        setTimeout(() => emailEl?.focus(), 60);
    }

    export function close() {
        open = false;
    }

    function submit() {
        const e = email.trim();
        if (!e || !personId) return;
        oninvite?.({ personId, email: e });
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            submit();
        }
    }
</script>

<V2Modal
    {open}
    title={$t("v2.shareTitle", { name: personName })}
    size="sm"
    onclose={close}
    testid="v2-share-modal"
>
    {#snippet body()}
        <label for="v2-share-email" class="field-label">{$t("invite.email")}</label>
        <input
            id="v2-share-email"
            type="email"
            class="form-control"
            placeholder="name@gmail.com"
            bind:value={email}
            bind:this={emailEl}
            onkeydown={handleKeydown}
            data-testid="v2-share-email"
        />
        <p class="hint">{$t("v2.shareEmailHint")}</p>
    {/snippet}

    {#snippet footer()}
        <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.cancel")}</button>
        <button
            type="button"
            class="btn btn-primary"
            disabled={!email.trim()}
            onclick={submit}
            data-testid="v2-share-generate"
        >
            {$t("v2.shareGenerate")}
        </button>
    {/snippet}
</V2Modal>

<style>
    .field-label {
        display: block;
        margin: 4px 0 6px;
        font-size: 0.85rem;
        font-weight: 500;
        color: #495057;
    }

    .hint {
        margin: 8px 0 0;
        font-size: 0.78rem;
        color: #6c757d;
    }
</style>
