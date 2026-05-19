<script lang="ts">
    import * as bootstrap from "bootstrap";
    import type { StemmaDescription } from "../../model";
    import { t } from "../../i18n";

    type Props = {
        onstemmaRemoved?: (id: string) => void;
    };

    let { onstemmaRemoved }: Props = $props();

    let modalEl = $state<HTMLElement>(null);
    let selectedStemma = $state<StemmaDescription>(null);

    function handleRemoveStemmaClick() {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        onstemmaRemoved?.(selectedStemma.id);
    }

    export function askForConfirmation(s: StemmaDescription) {
        selectedStemma = s;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                {#if selectedStemma}
                    <h5 class="modal-title">{$t("removeStemma.title", { name: selectedStemma.name })}</h5>
                {/if}
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                <button type="button" class="btn btn-danger" onclick={handleRemoveStemmaClick}>{$t("common.delete")}</button>
            </div>
        </div>
    </div>
</div>
