<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { onMount } from "svelte";
    import * as bootstrap from "bootstrap";

    const dispatch = createEventDispatcher();

    let modalEl;
    let input;

    onMount(() => {
        modalEl.addEventListener("shown.bs.modal", () => input.focus());
    });

    function handleAddStemmaClick() {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        let name = input.value;
        input.value = "";
        dispatch("stemmaAdded", name);
    }

    export function promptNewStemma() {
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
                <h5 class="modal-title" id="addStemmaLabel">Добавить новую родословную</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <label for="stemmaNameInput" class="form-label">Название родословной</label>
                <input class="form-control" id="stemmaNameInput" bind:this={input} />
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-primary" on:click={handleAddStemmaClick}>Добавить</button>
            </div>
        </div>
    </div>
</div>
