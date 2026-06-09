<script lang="ts">
    import type { Snippet } from "svelte";
    import { t } from "../i18n";

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
    <div class="modal-backdrop" onclick={handleBackdrop} aria-hidden="true"></div>
    <div
        class="modal-panel size-{size}"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testid}
    >
        {#if title}
            <div class="modal-header">
                <h6 class="modal-title">{title}</h6>
                <button
                    type="button"
                    class="modal-close"
                    aria-label={$t("common.close")}
                    onclick={close}
                >
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        {/if}

        <div class="modal-body" class:scroll>
            {@render body()}
        </div>

        {#if footer}
            <div class="modal-footer">
                {@render footer()}
            </div>
        {/if}
    </div>
{/if}

<style>
    .modal-backdrop {
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

    .modal-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(---bg-surface);
        border-radius: var(---radius-modal);
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

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px 12px;
        gap: 12px;
    }

    .modal-title {
        margin: 0;
        font-weight: var(---fw-title);
        font-size: var(---fs-title);
        color: var(---text-primary);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .modal-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: var(---text-muted);
        cursor: pointer;
        font-size: var(---fs-label);
        transition: background-color 0.12s ease, color 0.12s ease;
        flex-shrink: 0;
    }

    .modal-close:hover {
        background: #f1f3f5;
        color: var(---text-primary);
    }

    .modal-body {
        padding: 4px 22px 16px;
        flex: 1;
        min-height: 0;
    }

    .modal-body.scroll {
        overflow-y: auto;
    }

    .modal-footer {
        padding: 12px 22px 18px;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        border-top: 1px solid var(---border-subtle);
    }

    @keyframes slide-up {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
    }

    @media (max-width: 767px) {
        .modal-panel,
        .modal-panel.size-sm,
        .modal-panel.size-md,
        .modal-panel.size-lg {
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            max-width: 100%;
            transform: none;
            max-height: 85vh;
            border-radius: 20px 20px 0 0;
            box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
            animation: slide-up 0.22s ease-out;
        }

        .modal-body {
            overflow-y: auto;
        }
    }
</style>
