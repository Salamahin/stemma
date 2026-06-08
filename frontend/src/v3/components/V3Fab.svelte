<script lang="ts">
    import { t } from "../../i18n";

    type Props = {
        editMode: boolean;
        panMode: boolean;
        disabled: boolean;
        oneditToggle?: () => void;
        onpanToggle?: () => void;
        onaddPerson?: () => void;
    };

    let { editMode, panMode, disabled, oneditToggle, onpanToggle, onaddPerson }: Props = $props();
</script>

<div class="v3-fab-cluster">
    {#if editMode}
        <button
            type="button"
            class="fab fab-secondary"
            class:active={panMode}
            aria-label={panMode ? $t("v2.panModeOff") : $t("v2.panModeOn")}
            aria-pressed={panMode}
            disabled={disabled}
            onclick={() => onpanToggle?.()}
            data-testid="v3-pan-fab"
        >
            <i class="bi bi-arrows-move"></i>
        </button>
        <button
            type="button"
            class="fab fab-secondary"
            aria-label={$t("v2.addPersonFab")}
            disabled={disabled}
            onclick={() => onaddPerson?.()}
            data-testid="v3-add-person-fab"
        >
            <i class="bi bi-person-plus"></i>
        </button>
    {/if}

    <button
        type="button"
        class="fab fab-primary"
        class:active={editMode}
        aria-label={editMode ? $t("v2.exitEditMode") : $t("v2.enterEditMode")}
        disabled={disabled}
        onclick={() => oneditToggle?.()}
        data-testid="v3-edit-fab"
    >
        {#if editMode}
            <i class="bi bi-x-lg"></i>
        {:else}
            <i class="bi bi-pencil"></i>
        {/if}
    </button>
</div>

<style>
    .v3-fab-cluster {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }

    .fab {
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1.25rem;
        transition: box-shadow 0.15s ease, transform 0.1s ease;
    }

    .fab:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .fab:not(:disabled):hover {
        transform: translateY(-2px);
    }

    .fab-primary {
        width: 56px;
        height: 56px;
        background: #0d6efd;
        color: #fff;
        box-shadow: 0 4px 12px rgba(13, 110, 253, 0.4);
    }

    .fab-primary.active {
        background: #495057;
        box-shadow: 0 4px 12px rgba(73, 80, 87, 0.4);
    }

    .fab-primary:not(:disabled):hover {
        box-shadow: 0 6px 18px rgba(13, 110, 253, 0.5);
    }

    .fab-secondary {
        width: 48px;
        height: 48px;
        background: #fff;
        color: #0d6efd;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .fab-secondary:not(:disabled):hover {
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
    }

    .fab-secondary.active {
        background: #495057;
        color: #fff;
        box-shadow: 0 4px 12px rgba(73, 80, 87, 0.4);
    }

    .fab-secondary.active:not(:disabled):hover {
        box-shadow: 0 6px 18px rgba(73, 80, 87, 0.5);
    }

    @media (max-width: 767.98px) {
        .fab-primary {
            width: 48px;
            height: 48px;
            font-size: 1.1rem;
        }

        .fab-secondary {
            width: 40px;
            height: 40px;
            font-size: 1rem;
        }
    }
</style>
