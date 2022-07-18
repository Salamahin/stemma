<script context="module" lang="ts">
    import { StoredPerson, NewPerson } from "../../model";

    export type UpdatePerson = {
        id: string;
        pin: boolean;
        description: NewPerson;
    };

    export type ShowPerson = {
        pin: boolean;
        description: StoredPerson;
    };
</script>

<script lang="ts">
    import * as bootstrap from "bootstrap";
    import { createEventDispatcher } from "svelte";

    let modalEl;
    const dispatch = createEventDispatcher();

    let pinned: boolean;
    let name: string;
    let birthDate: string;
    let deathDate: string;
    let bio: string;
    let id: string;

    function personUpdated() {
        dispatch("personUpdated", { id: id, description: { name: name, birthDate: birthDate, deathDate: deathDate, bio: bio }, pin: pinned });

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function personRemoved() {
        dispatch("personRemoved", id);

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    export function showPersonDetails(p: ShowPerson) {
        id = p.description.id;
        name = p.description.name;
        birthDate = p.description.birthDate;
        deathDate = p.description.deathDate;
        bio = p.description.bio;
        pinned = p.pin;

        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" id="personDetailsModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title ms-2" id="addFamlilyLabel">Персональная информация</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <div class="mb-3">
                    <label for="personNameInput" class="form-label">Имя</label>
                    <input class="form-control" id="personNameInput" aria-describedby="personNameHelp" bind:value={name} />
                </div>
                <div class="mb-3">
                    <label for="personBirthDate" class="form-label">Дата рождения</label>
                    <input type="date" class="form-control" id="personBirthDateInput" bind:value={birthDate} />
                </div>
                <div class="mb-3">
                    <label for="personDeathDate" class="form-label">Дата смерти</label>
                    <input type="date" class="form-control" id="personDeathDateInput" bind:value={deathDate} />
                </div>
                <div class="mb-3">
                    <label for="personDeathDate" class="form-label">Био</label>
                    <textarea class="form-control" rows="6" id="personBioInput" bind:value={bio} />
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="flexSwitchCheckDefault" bind:checked={pinned} />
                    <label class="form-check-label" for="flexSwitchCheckDefault">Закрепить</label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-danger me-auto" on:click={() => personRemoved()}>Удалить</button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-primary" on:click={() => personUpdated()}>Сохранить</button>
            </div>
        </div>
    </div>
</div>
