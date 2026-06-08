<script lang="ts">
    import { t } from "../../i18n";

    type Props = {
        editMode: boolean;
        onaddPerson?: () => void;
    };

    let { editMode, onaddPerson }: Props = $props();
</script>

<div class="v3-empty-state" data-testid="v3-empty-state">
    <div class="empty-card">
        <i class="bi bi-people empty-icon"></i>
        <p class="empty-text">{$t("v2.emptyStemma")}</p>
        {#if editMode}
            <button type="button" class="btn btn-primary" onclick={() => onaddPerson?.()}>
                {$t("v2.emptyStemmaCta")}
            </button>
        {/if}
    </div>
</div>

<style>
    .v3-empty-state {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .empty-card {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        padding: 40px 48px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
    }

    .empty-icon {
        font-size: 3rem;
        color: #adb5bd;
    }

    .empty-text {
        margin: 0;
        color: #6c757d;
        font-size: 1rem;
    }
</style>
