<script lang="ts">
    import { t } from "../../i18n";

    type Props = {
        onconfirm?: (name: string) => void;
    };

    let { onconfirm }: Props = $props();

    let open = $state(false);
    let inputEl = $state<HTMLInputElement | null>(null);

    export function prompt() {
        open = true;
        setTimeout(() => inputEl?.focus(), 50);
    }

    function confirm() {
        const name = inputEl?.value?.trim() ?? "";
        if (!name) return;
        open = false;
        onconfirm?.(name);
    }

    function cancel() {
        open = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") confirm();
        if (e.key === "Escape") cancel();
    }

    function handleBackdropClick() {
        cancel();
    }
</script>

{#if open}
    <div class="name-modal-backdrop" onclick={handleBackdropClick} aria-hidden="true"></div>
    <div class="name-modal-panel" role="dialog" aria-modal="true" aria-label={$t("v2.addPerson")}>
        <h6 class="modal-title">{$t("v2.addPerson")}</h6>
        <input
            class="form-control"
            placeholder={$t("v2.namePlaceholder")}
            bind:this={inputEl}
            onkeydown={handleKeydown}
            data-testid="v2-name-input"
        />
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick={cancel}>{$t("common.cancel")}</button>
            <button
                type="button"
                class="btn btn-primary"
                onclick={confirm}
                data-testid="v2-name-confirm"
            >
                {$t("common.add")}
            </button>
        </div>
    </div>
{/if}

<style>
    .name-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 1060;
    }

    .name-modal-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(380px, calc(100vw - 32px));
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        padding: 24px;
        z-index: 1070;
        display: flex;
        flex-direction: column;
        gap: 16px;
        animation: pop-in 0.15s ease-out;
    }

    @keyframes pop-in {
        from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .modal-title {
        margin: 0;
        font-weight: 700;
        font-size: 1rem;
    }

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }
</style>
