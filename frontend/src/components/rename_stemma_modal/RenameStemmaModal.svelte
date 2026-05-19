<script lang="ts">
    import { onMount } from "svelte";
    import * as bootstrap from "bootstrap";
    import { t } from "../../i18n";

    type Props = {
        onstemmaRenamed?: (payload: { stemmaId: string; name: string }) => void;
    };

    let { onstemmaRenamed }: Props = $props();

    let modalEl = $state<HTMLElement>(null);
    let input = $state<HTMLInputElement>(null);
    let renamedStemmaId = $state<string>(null);

    onMount(() => {
        modalEl.addEventListener("shown.bs.modal", () => input.focus());
    });

    function handleRenameClick() {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        const name = input.value;
        input.value = "";
        onstemmaRenamed?.({ stemmaId: renamedStemmaId, name });
    }

    export function promptStemmaRename(stemmaId: string, currentName: string) {
        renamedStemmaId = stemmaId;
        if (input) input.value = currentName;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div
    class="modal fade"
    id="renameStemmaModal"
    data-bs-backdrop="static"
    data-bs-keyboard="false"
    tabindex="-1"
    aria-labelledby="renameStemmaLabel"
    aria-hidden="true"
    bind:this={modalEl}
>
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="renameStemmaLabel">{$t("stemma.renameTitle")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <label for="renameStemmaInput" class="form-label">{$t("stemma.nameLabel")}</label>
                <input class="form-control" id="renameStemmaInput" bind:this={input} />
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                <button type="button" class="btn btn-primary" onclick={handleRenameClick}>{$t("stemma.rename")}</button>
            </div>
        </div>
    </div>
</div>
