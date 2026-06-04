<script lang="ts">
    import type { LinkRole } from "../../model";
    import { t } from "../../i18n";

    type Props = {
        onpick?: (role: LinkRole) => void;
        oncancel?: () => void;
    };

    let { onpick, oncancel }: Props = $props();
</script>

<div class="link-role-menu" data-testid="v2-link-role-menu">
    <div class="role-title">{$t("v2.linkRoleTitle")}</div>
    <button
        type="button"
        class="btn btn-outline-primary btn-sm role-btn"
        onclick={() => onpick?.("spouse")}
        data-testid="v2-link-role-spouse"
    >
        {$t("v2.linkRoleSpouse")}
    </button>
    <button
        type="button"
        class="btn btn-outline-primary btn-sm role-btn"
        onclick={() => onpick?.("parent")}
        data-testid="v2-link-role-parent"
    >
        {$t("v2.linkRoleParent")}
    </button>
    <button
        type="button"
        class="btn btn-outline-primary btn-sm role-btn"
        onclick={() => onpick?.("child")}
        data-testid="v2-link-role-child"
    >
        {$t("v2.linkRoleChild")}
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
        font-weight: var(--v2-fw-section);
        font-size: var(--v2-fs-body);
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
