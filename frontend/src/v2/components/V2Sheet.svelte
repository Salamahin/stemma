<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        open: boolean;
        anchorEl?: Element | null;
        onclose?: () => void;
        body: Snippet;
        footer?: Snippet;
        testid?: string;
    };

    let { open, anchorEl = null, onclose, body, footer, testid }: Props = $props();

    const isMobile = $derived(typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches);

    type PopoverPos = { top: number; left: number; placement: "right" | "left" | "below" };

    const popoverPos = $derived.by<PopoverPos>(() => {
        if (!open || isMobile || !anchorEl) return { top: 0, left: 0, placement: "right" };
        const rect = anchorEl.getBoundingClientRect();
        const popW = 320;
        const popH = 300;
        const margin = 12;

        const anchorInView =
            rect.right > 0 && rect.left < window.innerWidth &&
            rect.bottom > 0 && rect.top < window.innerHeight;

        if (!anchorInView) {
            const left = Math.max(8, (window.innerWidth - popW) / 2);
            const top = Math.max(8, (window.innerHeight - popH) / 2);
            return { top, left, placement: "below" };
        }

        const spaceRight = window.innerWidth - rect.right;
        const spaceLeft = rect.left;

        let left: number;
        let placement: "right" | "left" | "below";

        if (spaceRight >= popW + margin) {
            left = rect.right + margin;
            placement = "right";
        } else if (spaceLeft >= popW + margin) {
            left = rect.left - popW - margin;
            placement = "left";
        } else {
            left = Math.max(8, (window.innerWidth - popW) / 2);
            placement = "below";
        }

        const centeredTop = rect.top + rect.height / 2 - popH / 2;
        const top = Math.max(8, Math.min(centeredTop, window.innerHeight - popH - 8));

        return { top, left, placement };
    });

    function handleBackdropClick() {
        onclose?.();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") onclose?.();
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    {#if isMobile}
        <div class="sheet-backdrop" onclick={handleBackdropClick} aria-hidden="true"></div>
        <div class="bottom-sheet" data-testid={testid} role="dialog" aria-modal="true">
            <div class="sheet-handle"></div>
            <div class="sheet-body">
                {@render body()}
            </div>
            {#if footer}
                <div class="sheet-footer">
                    {@render footer()}
                </div>
            {/if}
        </div>
    {:else if anchorEl}
        <div
            class="popover-panel"
            style="top: {popoverPos.top}px; left: {popoverPos.left}px;"
            data-testid={testid}
            role="dialog"
            aria-modal="true"
        >
            <div class="popover-body">
                {@render body()}
            </div>
            {#if footer}
                <div class="popover-footer">
                    {@render footer()}
                </div>
            {/if}
        </div>
    {:else}
        <div class="sheet-backdrop" onclick={handleBackdropClick} aria-hidden="true"></div>
        <div class="centered-panel" data-testid={testid} role="dialog" aria-modal="true">
            <div class="sheet-body">
                {@render body()}
            </div>
            {#if footer}
                <div class="sheet-footer">
                    {@render footer()}
                </div>
            {/if}
        </div>
    {/if}
{/if}

<style>
    .sheet-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 1040;
    }

    .bottom-sheet {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #fff;
        border-radius: 20px 20px 0 0;
        box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
        z-index: 1050;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        animation: slide-up 0.22s ease-out;
    }

    @keyframes slide-up {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
    }

    .sheet-handle {
        width: 40px;
        height: 4px;
        background: #dee2e6;
        border-radius: 2px;
        margin: 12px auto 8px;
        flex-shrink: 0;
    }

    .sheet-body {
        flex: 1;
        overflow-y: auto;
        padding: 8px 20px 4px;
    }

    .sheet-footer {
        padding: 12px 20px 20px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .popover-panel {
        position: fixed;
        width: 320px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        z-index: 1050;
        animation: pop-in 0.15s ease-out;
    }

    @keyframes pop-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }

    .popover-body {
        padding: 16px 18px 8px;
    }

    .popover-footer {
        padding: 8px 18px 16px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .centered-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(480px, calc(100vw - 32px));
        max-height: calc(100vh - 48px);
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
        z-index: 1050;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
</style>
