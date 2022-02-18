<script lang="ts">
    import {createEventDispatcher} from "svelte";
    import {onMount} from 'svelte';

    const dispatch = createEventDispatcher();

    let forceAdd = false
    let modalEl;
    let input;

    onMount(() => {
        modalEl.addEventListener('shown.bs.modal', () => input.focus())
    })

    function handleAddGraphClick() {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        let name = input.value
        dispatch("graphAdded", name);
    }

    export function forcePromptNewGraph() {
        forceAdd = true;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    export function promptNewGraph() {
        forceAdd = false;
        modalEl.show();
    }
</script>

<div class="modal fade" id="addGraphModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1"
     aria-labelledby="addGraphLabel" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addGraphLabel">Добавить новый граф</h5>
                {#if !forceAdd}
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                {/if}
            </div>
            <div class="modal-body">
                <label for="graphNameInput" class="form-label">Название графа</label>
                <input class="form-control" id="graphNameInput" bind:this={input}>
            </div>
            <div class="modal-footer">
                {#if !forceAdd}
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                {/if}
                <button type="button" class="btn btn-primary" on:click={handleAddGraphClick}>Добавить</button>
            </div>
        </div>
    </div>
</div>

