<script lang="ts">
    import { t } from "../i18n";
    import Modal from "./Modal.svelte";

    type Props = {
        // The link minted for the current request; null until it arrives.
        link?: string | null;
        pending?: boolean;
        oncreate?: (payload: { personId: string; email: string }) => void;
    };

    let { link = null, pending = false, oncreate }: Props = $props();

    type CopyState = "idle" | "copied" | "failed";

    let open = $state(false);
    let personId = $state("");
    let personName = $state("");
    let email = $state("");
    let requested = $state(false);
    let copyState = $state<CopyState>("idle");
    let linkInput = $state<HTMLInputElement | null>(null);

    const submitDisabled = $derived(!email.trim() || pending);
    const shownLink = $derived(requested ? link : null);
    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

    export function show(args: { personId: string; name: string }) {
        personId = args.personId;
        personName = args.name;
        email = "";
        requested = false;
        copyState = "idle";
        open = true;
    }

    export function close() {
        open = false;
    }

    export function dismiss() {
        close();
    }

    // Copy as soon as the link arrives, so it is in the clipboard without an
    // extra click; the result step says whether that worked.
    $effect(() => {
        if (shownLink) void copyLink(shownLink);
    });

    async function copyLink(value: string) {
        try {
            if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
            await navigator.clipboard.writeText(value);
            copyState = "copied";
        } catch (err) {
            console.warn("Copying the invite link failed", err);
            copyState = "failed";
            linkInput?.select();
        }
    }

    async function shareLink(value: string) {
        try {
            await navigator.share({ title: $t("shareTitle", { name: personName }), url: value });
        } catch {
            // The user closed the share sheet; the link is still on screen.
        }
    }

    function handleCreate() {
        const value = email.trim();
        if (!value || !personId || pending) return;
        email = value;
        requested = true;
        copyState = "idle";
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
        {#if shownLink}
            <div data-testid="share-access-result">
                <p class="status" class:failed={copyState === "failed"} data-testid="share-access-copy-status">
                    {#if copyState === "copied"}
                        <i class="bi bi-clipboard-check"></i> {$t("shareLinkCopied")}
                    {:else if copyState === "failed"}
                        <i class="bi bi-exclamation-triangle"></i> {$t("shareLinkCopyFailed")}
                    {:else}
                        {$t("shareLinkReady")}
                    {/if}
                </p>
                <div class="link-row">
                    <input
                        bind:this={linkInput}
                        type="text"
                        class="form-control"
                        readonly
                        value={shownLink}
                        onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
                        data-testid="share-access-link"
                    />
                    <button
                        type="button"
                        class="btn btn-outline-secondary"
                        onclick={() => copyLink(shownLink)}
                        data-testid="share-access-copy"
                    >{$t("shareCopy")}</button>
                </div>
                <ol class="steps">
                    <li>{$t("shareStepSend", { name: personName })}</li>
                    <li>{$t("shareStepSignIn", { email })}</li>
                </ol>
            </div>
        {:else}
            <label for="share-access-email" class="field-label">{$t("shareEmailLabel")}</label>
            <input
                id="share-access-email"
                type="email"
                class="form-control"
                placeholder="name@gmail.com"
                bind:value={email}
                onkeydown={handleKeydown}
                disabled={pending}
                data-testid="share-access-email"
            />
            <p class="hint">{$t("shareEmailHint")}</p>
        {/if}
    {/snippet}

    {#snippet footer()}
        {#if shownLink}
            {#if canShare}
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => shareLink(shownLink)}
                    data-testid="share-access-share"
                >{$t("shareSend")}</button>
            {/if}
            <button
                type="button"
                class="btn btn-primary"
                onclick={close}
                data-testid="share-access-done"
            >{$t("shareDone")}</button>
        {:else}
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
            >{pending ? $t("shareCreatingLink") : $t("shareCreateLink")}</button>
        {/if}
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

    .status {
        margin: 0 0 8px;
        font-weight: var(---fw-label);
        color: var(---text-secondary);
    }

    .status.failed {
        color: var(---text-danger);
    }

    .link-row {
        display: flex;
        gap: 8px;
    }

    .link-row input {
        flex: 1;
        min-width: 0;
        font-family: monospace;
        font-size: var(---fs-hint);
    }

    .steps {
        margin: 12px 0 0;
        padding-left: 20px;
        font-size: var(---fs-hint);
        color: var(---text-secondary);
    }

    .steps li + li {
        margin-top: 4px;
    }
</style>
