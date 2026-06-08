<script lang="ts">
    import { t } from "../../i18n";
    import type { GhostFamilyAction } from "../ghostHelpers";

    type Props = {
        action: GhostFamilyAction;
        onconfirm?: (name: string) => void;
        oncancel?: () => void;
    };

    let { action, onconfirm, oncancel }: Props = $props();

    let name = $state("");

    const title = $derived(action === "addChild" ? $t("v2.familyGhostAddChild") : $t("v2.familyGhostAddSpouse"));

    function confirm() {
        const trimmed = name.trim();
        if (!trimmed) return;
        onconfirm?.(trimmed);
    }
</script>

<div class="family-ghost-body" data-testid="v3-family-ghost-popover">
    <div class="ghost-title">{title}</div>
    <input
        type="text"
        class="form-control form-control-sm"
        placeholder={$t("v2.namePlaceholder")}
        bind:value={name}
        data-testid="v3-family-ghost-name"
        onkeydown={(e) => { if (e.key === "Enter") confirm(); }}
    />
    <div class="ghost-actions">
        <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => oncancel?.()}
            data-testid="v3-ghost-cancel"
        >
            {$t("common.cancel")}
        </button>
        <button
            type="button"
            class="btn btn-primary btn-sm ms-auto"
            disabled={!name.trim()}
            onclick={confirm}
            data-testid="v3-ghost-confirm"
        >
            {$t("common.ok")}
        </button>
    </div>
</div>

<style>
    .family-ghost-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .ghost-title {
        font-weight: 700;
        font-size: 0.95rem;
    }
    .ghost-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        padding-top: 8px;
        border-top: 1px solid #f1f3f5;
    }
</style>
