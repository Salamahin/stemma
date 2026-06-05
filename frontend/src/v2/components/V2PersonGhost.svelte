<script lang="ts">
    import { t } from "../../i18n";

    export type PersonGhostAction = "addChild" | "addSpouse";

    type Props = {
        onsubmit?: (payload: { action: PersonGhostAction; name: string }) => void;
        oncancel?: () => void;
    };

    let { onsubmit, oncancel }: Props = $props();

    let stage = $state<"pick" | "name">("pick");
    let action = $state<PersonGhostAction>("addChild");
    let name = $state("");

    function pick(a: PersonGhostAction) {
        action = a;
        stage = "name";
    }

    function confirm() {
        const trimmed = name.trim();
        if (!trimmed) return;
        onsubmit?.({ action, name: trimmed });
    }
</script>

<div class="ghost-menu" data-testid="v2-person-ghost-menu">
    {#if stage === "pick"}
        <button
            type="button"
            class="btn btn-outline-primary btn-sm role-btn"
            onclick={() => pick("addChild")}
            data-testid="v2-person-ghost-add-child"
        >
            {$t("v2.familyGhostAddChild")}
        </button>
        <button
            type="button"
            class="btn btn-outline-primary btn-sm role-btn"
            onclick={() => pick("addSpouse")}
            data-testid="v2-person-ghost-add-spouse"
        >
            {$t("v2.familyGhostAddSpouse")}
        </button>
        <button
            type="button"
            class="btn btn-link btn-sm cancel-btn"
            onclick={() => oncancel?.()}
        >
            {$t("common.cancel")}
        </button>
    {:else}
        <input
            type="text"
            class="form-control form-control-sm"
            placeholder={$t("v2.namePlaceholder")}
            bind:value={name}
            data-testid="v2-person-ghost-name"
            onkeydown={(e) => { if (e.key === "Enter") confirm(); }}
        />
        <div class="actions">
            <button
                type="button"
                class="btn btn-link btn-sm cancel-btn"
                onclick={() => oncancel?.()}
            >
                {$t("common.cancel")}
            </button>
            <button
                type="button"
                class="btn btn-primary btn-sm ms-auto"
                disabled={!name.trim()}
                onclick={confirm}
                data-testid="v2-person-ghost-confirm"
            >
                {$t("common.add")}
            </button>
        </div>
    {/if}
</div>

<style>
    .ghost-menu {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 4px 0;
    }
    .role-btn {
        text-align: left;
    }
    .cancel-btn {
        padding: 4px 8px;
    }
    .actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }
</style>
