<script lang="ts">
    import type { CreateNewPerson, PersonDescription, Stemma } from "../../model";
    import type { StemmaIndex } from "../../stemmaIndex";
    import { t } from "../../i18n";
    import CreateSelectPerson from "../../components/family_modal/CreateSelectPerson.svelte";
    import { toPersonArg, type GhostFamilyAction, type PersonChoice, type PersonArg } from "../ghostHelpers";

    type Props = {
        action: GhostFamilyAction;
        stemma: Stemma;
        stemmaIndex: StemmaIndex;
        onconfirm?: (arg: PersonArg) => void;
        oncancel?: () => void;
    };

    let { action, stemma, stemmaIndex, onconfirm, oncancel }: Props = $props();

    let selectedPerson = $state<PersonChoice | null>(null);

    const title = $derived(action === "addChild" ? $t("v2.familyGhostAddChild") : $t("v2.familyGhostAddSpouse"));

    function confirm() {
        if (!selectedPerson) return;
        onconfirm?.(toPersonArg(selectedPerson));
    }
</script>

<div class="family-ghost-body" data-testid="v2-family-ghost-popover">
    <div class="ghost-title">{title}</div>
    <div class="picker-wrap">
        <CreateSelectPerson
            {stemmaIndex}
            {stemma}
            hideNamesakes
            onselected={(p) => { selectedPerson = p; }}
        />
    </div>
    <div class="ghost-actions">
        <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick={() => oncancel?.()}
            data-testid="v2-ghost-cancel"
        >
            {$t("common.cancel")}
        </button>
        <button
            type="button"
            class="btn btn-primary btn-sm ms-auto"
            disabled={!selectedPerson}
            onclick={confirm}
            data-testid="v2-ghost-confirm"
        >
            {$t("common.ok")}
        </button>
    </div>
</div>

<style>
    .family-ghost-body {
        display: flex;
        flex-direction: column;
    }

    .ghost-title {
        font-weight: 700;
        font-size: 0.95rem;
        margin-bottom: 10px;
    }

    .picker-wrap {
        min-height: 300px;
    }

    .ghost-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        padding-top: 12px;
        border-top: 1px solid #f1f3f5;
        margin-top: 8px;
    }
</style>
