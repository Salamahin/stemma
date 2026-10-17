<script lang="ts">
    import { t } from "../i18n";
    import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES, isImageAttachment } from "../attachments";
    import type { Attachment } from "../model";

    type Props = {
        attachments: Attachment[];
        editable?: boolean;
        onaddLink?: (payload: { title: string; url: string; note: string }) => Promise<unknown> | void;
        onaddFile?: (payload: { file: File; title: string }) => Promise<unknown> | void;
        onremove?: (id: string) => void;
    };

    let { attachments, editable = false, onaddLink, onaddFile, onremove }: Props = $props();

    let addingLink = $state(false);
    let linkTitle = $state("");
    let linkUrl = $state("");
    let linkNote = $state("");
    let uploading = $state(false);
    let fileError = $state<string | null>(null);
    let fileInput = $state<HTMLInputElement | null>(null);

    const linkValid = $derived(/^https?:\/\/\S+$/i.test(linkUrl.trim()));

    function resetLinkForm() {
        addingLink = false;
        linkTitle = "";
        linkUrl = "";
        linkNote = "";
    }

    async function submitLink() {
        if (!linkValid) return;
        await onaddLink?.({ title: linkTitle || linkUrl, url: linkUrl, note: linkNote });
        resetLinkForm();
    }

    async function onFilePicked(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        if (file.size > MAX_ATTACHMENT_BYTES) {
            fileError = $t("attachments.tooBig");
            return;
        }
        fileError = null;
        uploading = true;
        try {
            await onaddFile?.({ file, title: file.name });
        } finally {
            uploading = false;
        }
    }
</script>

<div class="attachments" data-testid="attachments">
    <span class="field-label">{$t("attachments.title")}</span>

    {#if attachments.length === 0 && !editable}
        <p class="empty">{$t("attachments.empty")}</p>
    {/if}

    <ul class="list">
        {#each attachments as a (a.id)}
            <li data-testid="attachment">
                {#if isImageAttachment(a) && a.url}
                    <a href={a.url} target="_blank" rel="noopener noreferrer" class="thumb">
                        <img src={a.url} alt={a.title} loading="lazy" />
                    </a>
                {:else}
                    <i class="bi {a.kind === 'link' ? 'bi-link-45deg' : 'bi-file-earmark-text'} icon"></i>
                {/if}
                <div class="text">
                    {#if a.url}
                        <a href={a.url} target="_blank" rel="noopener noreferrer" data-testid="attachment-link">{a.title}</a>
                    {:else}
                        <span>{a.title}</span>
                    {/if}
                    {#if a.note}<div class="note">{a.note}</div>{/if}
                </div>
                {#if editable}
                    <button
                        type="button"
                        class="btn btn-sm btn-link remove"
                        aria-label={$t("attachments.remove")}
                        onclick={() => onremove?.(a.id)}
                        data-testid="attachment-remove"
                    ><i class="bi bi-x-lg"></i></button>
                {/if}
            </li>
        {/each}
    </ul>

    {#if editable}
        {#if addingLink}
            <div class="link-form">
                <input class="form-control form-control-sm" placeholder={$t("attachments.linkUrl")} bind:value={linkUrl} data-testid="attachment-url" />
                <input class="form-control form-control-sm" placeholder={$t("attachments.linkTitle")} bind:value={linkTitle} data-testid="attachment-title" />
                <input class="form-control form-control-sm" placeholder={$t("attachments.note")} bind:value={linkNote} />
                <div class="actions">
                    <button type="button" class="btn btn-sm btn-secondary" onclick={resetLinkForm}>{$t("attachments.cancel")}</button>
                    <button type="button" class="btn btn-sm btn-primary" disabled={!linkValid} onclick={submitLink} data-testid="attachment-save">{$t("attachments.save")}</button>
                </div>
            </div>
        {:else}
            <div class="actions start">
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick={() => (addingLink = true)} data-testid="attachment-add-link">
                    <i class="bi bi-link-45deg"></i> {$t("attachments.addLink")}
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" disabled={uploading} onclick={() => fileInput?.click()} data-testid="attachment-add-file">
                    <i class="bi bi-upload"></i> {uploading ? $t("attachments.uploading") : $t("attachments.addFile")}
                </button>
                <input bind:this={fileInput} type="file" accept={ATTACHMENT_ACCEPT} class="d-none" onchange={onFilePicked} data-testid="attachment-file-input" />
            </div>
            <div class="hint">{$t("attachments.fileHint")}</div>
            {#if fileError}<div class="text-danger small">{fileError}</div>{/if}
        {/if}
    {/if}
</div>

<style>
    .attachments {
        margin-top: 12px;
    }

    .field-label {
        display: block;
        margin: 0 0 6px;
        font-size: var(---fs-label);
        color: var(---text-secondary);
        font-weight: var(---fw-label);
    }

    .empty,
    .hint {
        margin: 0;
        font-size: var(---fs-hint);
        color: var(---text-muted);
    }

    .list {
        list-style: none;
        margin: 0 0 6px;
        padding: 0;
    }

    .list li {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 4px 0;
    }

    .icon {
        font-size: 1.1rem;
        color: var(---text-secondary);
    }

    .thumb img {
        width: 40px;
        height: 40px;
        object-fit: cover;
        border-radius: 4px;
    }

    .text {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .note {
        font-size: var(---fs-hint);
        color: var(---text-muted);
    }

    .remove {
        padding: 0 4px;
    }

    .link-form {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .actions {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        flex-wrap: wrap;
    }

    .actions.start {
        justify-content: flex-start;
        margin-bottom: 4px;
    }
</style>
