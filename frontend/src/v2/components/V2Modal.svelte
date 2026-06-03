<script lang="ts">
    import type { Snippet } from "svelte";
    import { t } from "../../i18n";

    type Size = "sm" | "md" | "lg";

    type Props = {
        open: boolean;
        title?: string;
        size?: Size;
        scroll?: boolean;
        dismissOnBackdrop?: boolean;
        onclose?: () => void;
        body: Snippet;
        footer?: Snippet;
        headerActions?: Snippet;
        testid?: string;
    };

    let {
        open,
        title,
        size = "md",
        scroll = false,
        dismissOnBackdrop = true,
        onclose,
        body,
        footer,
        headerActions,
        testid,
    }: Props = $props();

    function close() {
        onclose?.();
    }

    function handleBackdrop() {
        if (dismissOnBackdrop) close();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (!open) return;
        if (e.key === "Escape") close();
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div class="v2-modal-backdrop" onclick={handleBackdrop} aria-hidden="true"></div>
    <div
        class="v2-modal-panel size-{size}"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testid}
    >
        {#if title}
            <div class="v2-modal-header">
                <h6 class="v2-modal-title">{title}</h6>
                <div class="v2-modal-header-actions">
                    {#if headerActions}
                        {@render headerActions()}
                    {/if}
                    <button
                        type="button"
                        class="v2-modal-close"
                        aria-label={$t("common.close")}
                        onclick={close}
                    >
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
        {/if}

        <div class="v2-modal-body" class:scroll>
            {@render body()}
        </div>

        {#if footer}
            <div class="v2-modal-footer">
                {@render footer()}
            </div>
        {/if}
    </div>
{/if}

<style>
    .v2-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        z-index: 1060;
        animation: fade-in 0.12s ease-out;
    }

    @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .v2-modal-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        z-index: 1070;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 32px);
        animation: pop-in 0.15s ease-out;
        overflow: hidden;
    }

    .size-sm { width: min(380px, calc(100vw - 32px)); }
    .size-md { width: min(480px, calc(100vw - 32px)); }
    .size-lg { width: min(720px, calc(100vw - 32px)); }

    @keyframes pop-in {
        from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .v2-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px 12px;
        gap: 12px;
    }

    .v2-modal-title {
        margin: 0;
        font-weight: 700;
        font-size: 1rem;
        color: #212529;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .v2-modal-header-actions {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
    }

    .v2-modal-close,
    :global(.v2-modal-header-actions .header-action-btn) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: #6c757d;
        cursor: pointer;
        font-size: 0.85rem;
        transition: background-color 0.12s ease, color 0.12s ease;
        flex-shrink: 0;
    }

    .v2-modal-close:hover {
        background: #f1f3f5;
        color: #212529;
    }

    :global(.v2-modal-header-actions .header-action-btn.danger:hover) {
        background: #f8d7da;
        color: #dc3545;
    }

    .v2-modal-body {
        padding: 4px 22px 16px;
        flex: 1;
        min-height: 0;
    }

    .v2-modal-body.scroll {
        overflow-y: auto;
    }

    .v2-modal-footer {
        padding: 12px 22px 18px;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        border-top: 1px solid #f0f0f0;
    }
</style>
