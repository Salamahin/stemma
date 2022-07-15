<script context="module" lang="ts">
    import { StoredPerson, NewPerson } from "../model";

    export type UpdatePerson = {
        id: string;
        description: NewPerson;
    };
</script>

<script lang="ts">
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

    function personUpdated(descr: NewPerson) {
        dispatch("personUpdated", ({ id: selectedPerson.id, description: descr }));
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function personRemoved() {
        dispatch("personRemoved", selectedPerson.id);
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    export function showPersonDetails(p: StoredPerson) {
        selectedPerson = p;
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" id="personDetailsModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-dialog-centered modal-fullscreen-lg-down">
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
                    <textarea class="form-control" rows="6" id="personBioInput">{selectedPerson.bio ? selectedPerson.bio : ""}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-danger me-auto" on:click={() => personRemoved()}>Удалить</button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button
                    type="button"
                    class="btn btn-primary"
                    on:click={() => {
                        personUpdated({
                            name: document.getElementById("personNameInput").value,
                            birthDate: document.getElementById("personBirthDateInput").value,
                            deathDate: document.getElementById("personDeathDateInput").value,
                            bio: document.getElementById("personBioInput").value,
                        });
                    }}>Сохранить</button
                >
            </div>
        </div>
    </div>
</div>
