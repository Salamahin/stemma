<script lang="ts">
    import * as bootstrap from "bootstrap";
    import { createEventDispatcher } from "svelte";
    import { DEFAULT_SETTINGS, Settings, ViewMode } from "../../model";

    let modalEl;
    let _settings: Settings = DEFAULT_SETTINGS;

    const dispatch = createEventDispatcher();

    function saveSettings() {
        let viewAll = document.getElementById("showAll").checked;

        dispatch("settingsChanged", {
            viewMode: viewAll ? ViewMode.ALL : ViewMode.EDITABLE_ONLY,
        });

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    export function show() {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Настройки отображения</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="viewMode" id="showAll" checked={_settings.viewMode == ViewMode.ALL} />
                    <label class="form-check-label" for="showAll"> Отображать всех </label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="viewMode" id="showEditable" checked={_settings.viewMode == ViewMode.EDITABLE_ONLY} />
                    <label class="form-check-label" for="showEditable"> Отображать только редактируемых </label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-primary" on:click={saveSettings}>Сохранить</button>
            </div>
        </div>
    </div>
</div>
