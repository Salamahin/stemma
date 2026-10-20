<script lang="ts">
    import type { Snippet } from "svelte";
    import { t } from "../i18n";

    /**
     * A panel sliding in from the left, full height, over the chart without
     * dimming it — the chart stays usable next to it (clicking another person
     * just shows them). Full screen on phones. Same shape as Modal.
     */
    type Props = {
        open: boolean;
        title?: string;
        onclose?: () => void;
        body: Snippet;
        footer?: Snippet;
        testid?: string;
    };

    let { open, title, onclose, body, footer, testid }: Props = $props();

    function handleKeydown(e: KeyboardEvent) {
        if (!open || e.key !== "Escape") return;
        // a dialog on top (confirm, prompt, photo viewer) handles its own Escape
        if (document.querySelector('[aria-modal="true"]')) return;
        onclose?.();
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div class="side-panel" role="dialog" aria-label={title} data-testid={testid}>
        <div class="side-header">
            <h6 class="side-title">{title ?? ""}</h6>
            <button type="button" class="side-close" aria-label={$t("common.close")} onclick={() => onclose?.()}>
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
        <div class="side-body">
            {@render body()}
        </div>
        {#if footer}
            <div class="side-footer">
                {@render footer()}
            </div>
        {/if}
    </div>
{/if}

<style>
    .side-panel {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        width: min(420px, 100vw);
        background: var(---bg-surface);
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
        z-index: 1050;
        display: flex;
        flex-direction: column;
        animation: slide-in 0.2s ease-out;
    }

    @keyframes slide-in {
        from { transform: translateX(-100%); }
        to { transform: translateX(0); }
    }

    .side-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 20px 8px;
    }

    .side-title {
        margin: 0;
        flex: 1;
        min-width: 0;
        font-weight: var(---fw-title);
        font-size: var(---fs-title);
        color: var(---text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .side-close {
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
        flex-shrink: 0;
    }

    .side-close:hover {
        background: #f1f3f5;
        color: var(---text-primary);
    }

    .side-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 4px 20px 16px;
        /* a section may grow into the room left (the bio) */
        display: flex;
        flex-direction: column;
    }

    .side-body > :global(*) {
        flex-shrink: 0;
    }

    .side-footer {
        padding: 12px 20px 16px;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        border-top: 1px solid var(---border-subtle);
    }

    /* nothing to show (a read-only person in view mode) */
    .side-footer:empty {
        display: none;
    }

    @media (max-width: 767px) {
        .side-panel {
            width: 100vw;
            box-shadow: none;
        }
    }
</style>
