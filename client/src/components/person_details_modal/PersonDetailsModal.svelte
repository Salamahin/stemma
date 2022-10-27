<script context="module" lang="ts">
    import { PersonDescription, CreateNewPerson } from "../../model";
    import { imask } from "@imask/svelte";
    import { onMount } from "svelte";

    export type UpdatePerson = {
        id: string;
        pin: boolean;
        description: CreateNewPerson;
    };

    export type ShowPerson = {
        pin: boolean;
        description: PersonDescription;
    };
</script>

<script lang="ts">
    import * as bootstrap from "bootstrap";
    import { createEventDispatcher } from "svelte";

    let modalEl;
    const dispatch = createEventDispatcher();

    let pinned: boolean;
    let name: string;
    let birthDate: Date;
    let deathDate: Date;
    let bio: string;
    let id: string;
    let readOnly: boolean;

    let birthDateErrString: string;
    let deathDateErrString: string;

    function personUpdated() {
        dispatch("personUpdated", {
            id: id,
            description: {
                name: name,
                birthDate: birthDate.toString(),
                deathDate: deathDate.toString(),
                bio: bio,
            },
            pin: pinned,
        });

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function personRemoved() {
        dispatch("personRemoved", id);

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    export function showPersonDetails(p: ShowPerson) {
        id = p.description.id;
        name = p.description.name;
        birthDate = p.description.birthDate ? new Date(p.description.birthDate) : null;
        deathDate = p.description.deathDate ? new Date(p.description.deathDate) : null;
        bio = p.description.bio;
        pinned = p.pin;
        readOnly = p.description.readOnly;

        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    function parseMaskedDateStr(str: String) {
        var [day, month, year] = str.split(".");
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    function dateToMaskedDateStr(date: Date) {
        if (!date) return null;

        let day = date.getDate();
        let month = date.getMonth() + 1;
        let year = date.getFullYear();

        let dayStr = day < 10 ? "0" + day : day.toString();
        let monthStr = month < 10 ? "0" + month : month.toString();

        return [dayStr, monthStr, year.toString()].join(".");
    }

    const dateMaskingOpts = {
        mask: Date,
        lazy: true,
        max: new Date(),
        format: dateToMaskedDateStr,
        parse: parseMaskedDateStr,
    };

    function acceptBirthDate({ detail: maskRef }) {
        if (!maskRef.unmaskedValue) birthDateErrString = null;
        else birthDateErrString = "Неполная дата";
    }

    function completeBirthDate({ detail: maskRef }) {
        birthDateErrString = null;
        birthDate = parseMaskedDateStr(maskRef.value);
        validateLifetimeRange();
    }

    function acceptDeathDate({ detail: maskRef }) {
        if (!maskRef.unmaskedValue) deathDateErrString = null;
        else deathDateErrString = "Неполная дата";
    }

    function completeDeathDate({ detail: maskRef }) {
        deathDateErrString = null;
        deathDate = parseMaskedDateStr(maskRef.value);
        validateLifetimeRange();
    }

    function validateLifetimeRange() {
        if (!birthDate || !deathDate) return;

        if (deathDate < birthDate) {
            birthDateErrString = "Неверный диапазон дат";
            deathDateErrString = "Неверный диапазон дат";
        } else {
            birthDateErrString = null;
            deathDateErrString = null;
        }
    }
</script>

<div class="modal fade" id="personDetailsModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title ms-2" id="addFamlilyLabel">Персональная информация</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <form class="row g-3">
                    <div class="col-12">
                        <label for="personNameInput" class="form-label">Имя</label>
                        <input class="form-control" id="personNameInput" aria-describedby="personNameHelp" bind:value={name} readonly={readOnly} />
                    </div>
                    <div class="col-12 mb-2">Годы жизни</div>
                    <div class="col-md-6 mt-0">
                        <input
                            value={dateToMaskedDateStr(birthDate)}
                            use:imask={dateMaskingOpts}
                            on:accept={acceptBirthDate}
                            on:complete={completeBirthDate}
                            class="form-control birthdate-input {birthDateErrString ? 'is-invalid' : ''}"
                            readonly={readOnly}
                            placeholder="дд.мм.гггг"
                        />
                        <div class="invalid-feedback">{birthDateErrString}</div>
                    </div>
                    <div class="col-md-6 mt-0">
                        <input
                            value={dateToMaskedDateStr(deathDate)}
                            use:imask={dateMaskingOpts}
                            on:accept={acceptDeathDate}
                            on:complete={completeDeathDate}
                            class="form-control deathdate-input {deathDateErrString ? 'is-invalid' : ''}"
                            readonly={readOnly}
                            placeholder="дд.мм.гггг"
                        />
                        <div class="invalid-feedback">{deathDateErrString}</div>
                    </div>
                    <div class="col-12">
                        <label for="personBioInput" class="form-label">Био</label>
                        <textarea class="form-control" rows="6" id="personBioInput" bind:value={bio} readonly={readOnly} />
                    </div>
                    <div class="col-12">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="flexSwitchCheckDefault" bind:checked={pinned} />
                            <label class="form-check-label" for="flexSwitchCheckDefault">Закрепить</label>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                {#if !readOnly}
                    <button type="button" class="btn btn-danger me-auto" on:click={() => personRemoved()}>Удалить</button>
                {/if}
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                <button
                    type="button"
                    class="btn btn-primary"
                    disabled={birthDateErrString != null || deathDateErrString != null}
                    on:click={() => personUpdated()}>Сохранить</button
                >
            </div>
        </div>
    </div>
</div>
