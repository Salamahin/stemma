<script lang="ts">
    import { onMount } from "svelte";
    import * as bootstrap from "bootstrap";
    import { t } from "../../i18n";

    type Props = {
        onstemmaCloned?: (payload: { name: string; stemmaId: string }) => void;
    };

    let { onstemmaCloned }: Props = $props();

    let modalEl = $state<HTMLElement>(null);
    let input = $state<HTMLInputElement>(null);
    let clonedStemmaId = $state<string>(null);

    onMount(() => {
        modalEl.addEventListener("shown.bs.modal", () => input.focus());
    });

    function handleCloneStemmaClick() {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        const name = input.value;
        input.value = "";
        onstemmaCloned?.({ name, stemmaId: clonedStemmaId });
    }

    export function promptStemmaClone(stemmaId: string) {
        clonedStemmaId = stemmaId;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div
    class="modal fade"
    id="addStemmaModal"
    data-bs-backdrop="static"
    data-bs-keyboard="false"
    tabindex="-1"
    aria-labelledby="addStemmaLabel"
    aria-hidden="true"
    bind:this={modalEl}
>
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addStemmaLabel">{$t("stemma.cloneTitle")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <label for="stemmaNameInput" class="form-label">{$t("stemma.nameLabel")}</label>
                <input class="form-control" id="stemmaNameInput" bind:this={input} />
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                <button type="button" class="btn btn-primary" onclick={handleCloneStemmaClick}>{$t("stemma.clone")}</button>
            </div>
        </div>
    </div>
</div>
