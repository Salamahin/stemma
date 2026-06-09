<script lang="ts">
    import { t } from "../i18n";

    type Role = "parent" | "child";

    type Props = {
        onpick?: (role: Role) => void;
        oncancel?: () => void;
    };

    let { onpick, oncancel }: Props = $props();
</script>

<div class="link-role-menu" data-testid="link-role-menu">
    <div class="role-title">{$t("linkRoleTitle")}</div>
    <button
        type="button"
        class="btn btn-outline-primary btn-sm role-btn"
        onclick={() => onpick?.("parent")}
        data-testid="link-role-parent"
    >
        {$t("linkRoleParent")}
    </button>
    <button
        type="button"
        class="btn btn-outline-primary btn-sm role-btn"
        onclick={() => onpick?.("child")}
        data-testid="link-role-child"
    >
        {$t("linkRoleChild")}
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
    .link-role-menu {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 4px 0;
    }
    .role-title {
        font-weight: var(---fw-section);
        font-size: var(---fs-body);
        margin-bottom: 4px;
    }
    .role-btn {
        text-align: left;
    }
    .cancel-btn {
        align-self: flex-end;
        padding: 4px 8px;
    }
</style>
