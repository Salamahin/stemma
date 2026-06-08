<script lang="ts">
    import { t } from "../../i18n";
</script>

<div class="v3-edit-pill" aria-live="polite">
    <span class="pulse-dot"></span>
    {$t("v2.editMode")}
</div>

<style>
    .v3-edit-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #ffc107;
        color: #212529;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 4px 12px;
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        letter-spacing: 0.03em;
        white-space: nowrap;
    }

    .pulse-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #664d03;
        animation: pulse 1.6s ease-in-out infinite;
        flex-shrink: 0;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
    }
</style>
