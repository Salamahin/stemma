<script lang="ts">
    import { t } from "../../i18n";

    type Props = {
        onpick?: (role: "parent" | "child") => void;
        oncancel?: () => void;
    };

    let { onpick, oncancel }: Props = $props();

    function pick(role: "parent" | "child") {
        onpick?.(role);
    }
</script>

<div class="ghost-role-menu" data-testid="v2-person-ghost-menu">
    <button
        type="button"
        class="btn btn-outline-primary btn-sm role-btn"
        onclick={() => pick("parent")}
        data-testid="v2-anchor-as-parent"
    >
        {$t("v2.anchorAsParent")}
    </button>
    <button
        type="button"
        class="btn btn-outline-primary btn-sm role-btn"
        onclick={() => pick("child")}
        data-testid="v2-anchor-as-child"
    >
        {$t("v2.anchorAsChild")}
    </button>
    <button
        type="button"
        class="btn btn-link btn-sm cancel-btn"
        onclick={() => oncancel?.()}
    >
        {$t("common.cancel")}
    </button>
</div>

<style>
    .ghost-role-menu {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 4px 0;
    }

    .role-btn {
        text-align: left;
    }

    .cancel-btn {
        align-self: flex-end;
        padding: 4px 8px;
    }
</style>
