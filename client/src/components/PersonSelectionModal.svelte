<script lang="ts">
    import { StoredPerson } from "../model";
    import * as bootstrap from "bootstrap";
    import { createEventDispatcher } from "svelte";

    let modalEl;
    const dispatch = createEventDispatcher();

    let selectedPerson: StoredPerson = {
        id: "",
        name: "",
        birthDate: "",
        deathDate: "",
    };

    function personUpdated(p: StoredPerson) {
        selectedPerson = null;
        dispatch("personSelected", p);
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function personRemoved(p: StoredPerson) {
        selectedPerson = null;
        dispatch("personRemoved", p);
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    export function showPersonDetails(p: StoredPerson) {
        selectedPerson = p;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" id="personDetailsModal"  tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addFamlilyLabel">Изменить [{selectedPerson.id}]</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <label for="personNameInput" class="form-label">Имя</label>
                    <input class="form-control" id="personNameInput" aria-describedby="personNameHelp" value={selectedPerson.name} />
                </div>
                <div class="mb-3">
                    <label for="personBirthDate" class="form-label">Дата рождения</label>
                    <input type="date" class="form-control" id="personBirthDateInput" value={selectedPerson.birthDate} />
                </div>
                <div class="mb-3">
                    <label for="personDeathDate" class="form-label">Дата смерти</label>
                    <input type="date" class="form-control" id="personDeathDateInput" value={selectedPerson.deathDate} />
                </div>
                <div class="mb-3">
                    <label for="personDeathDate" class="form-label">Био</label>
                    <textarea class="form-control" rows="6">{selectedPerson.bio ? selectedPerson.bio : ""}</textarea>
                </div>
                <div class="mb-3 form-switch">
                    <input class="form-check-input" type="checkbox" id="flexSwitchCheckDefault">
                    <label class="form-check-label" for="flexSwitchCheckDefault">Закрепить ветку прямых родственников</label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-danger me-auto" on:click={() => personUpdated(null)}>Удалить</button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-primary" on:click={() => personUpdated(null)}>Сохранить</button>
            </div>
        </div>
    </div>
</div>
