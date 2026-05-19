<script lang="ts">
    import * as bootstrap from "bootstrap";
    import type { Settings } from "../../model";
    import { DEFAULT_SETTINGS, ViewMode } from "../../model";
    import { t } from "../../i18n";

    type Props = {
        onsettingsChanged?: (settings: Settings) => void;
    };

    let { onsettingsChanged }: Props = $props();

    let modalEl = $state<HTMLElement>(null);
    let _settings = $state<Settings>(DEFAULT_SETTINGS);

    function saveSettings() {
        const showAllInput = document.getElementById("showAll") as HTMLInputElement | null;
        const viewAll = showAllInput?.checked ?? false;

        onsettingsChanged?.({
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
                <h5 class="modal-title">{$t("settings.title")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="viewMode" id="showAll" checked={_settings.viewMode == ViewMode.ALL} />
                    <label class="form-check-label" for="showAll"> {$t("settings.showAll")} </label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="viewMode" id="showEditable" checked={_settings.viewMode == ViewMode.EDITABLE_ONLY} />
                    <label class="form-check-label" for="showEditable"> {$t("settings.showEditableOnly")} </label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                <button type="button" class="btn btn-primary" onclick={saveSettings}>{$t("common.save")}</button>
            </div>
        </div>
    </div>
</div>
