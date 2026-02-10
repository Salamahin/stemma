<script context="module" lang="ts">
    import type { PersonDescription, CreateNewPerson } from "../../model";
    import { imask } from "@imask/svelte";

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
    import { t } from "../../i18n";

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
                birthDate: dateToIsoLocalTime(birthDate),
                deathDate: dateToIsoLocalTime(deathDate),
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

    function dateToIsoLocalTime(d: Date) {
        if (!d) return null;

        let date = d.getDate();
        let month = d.getMonth() + 1;
        let year = d.getFullYear();

        let dateStr = date < 10 ? "0" + date : date.toString();
        let monthStr = month < 10 ? "0" + month : month.toString();

        return `${year}-${monthStr}-${dateStr}`;
    }

    export function showPersonDetails(p: ShowPerson) {
        id = p.description.id;
        name = p.description.name;
        birthDate = p.description.birthDate ? new Date(p.description.birthDate) : null;
        deathDate = p.description.deathDate ? new Date(p.description.deathDate) : null;
        const birthInput = document.getElementById("birthDateInput") as HTMLInputElement | null;
        if (birthInput) birthInput.value = dateToMaskedDateStr(birthDate) ?? "";
        const deathInput = document.getElementById("deathDateInput") as HTMLInputElement | null;
        if (deathInput) deathInput.value = dateToMaskedDateStr(deathDate) ?? "";
        bio = p.description.bio;
        pinned = p.pin;
        readOnly = p.description.readOnly;

        birthDateErrString = null;
        deathDateErrString = null;

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
        else birthDateErrString = $t("person.incompleteDate");
    }

    function completeBirthDate({ detail: maskRef }) {
        birthDateErrString = null;
        birthDate = parseMaskedDateStr(maskRef.value);
        validateLifetimeRange();
    }

    function acceptDeathDate({ detail: maskRef }) {
        if (!maskRef.unmaskedValue) deathDateErrString = null;
        else deathDateErrString = $t("person.incompleteDate");
    }

    function completeDeathDate({ detail: maskRef }) {
        deathDateErrString = null;
        deathDate = parseMaskedDateStr(maskRef.value);
        validateLifetimeRange();
    }

    function validateLifetimeRange() {
        if (!birthDate || !deathDate) return;

        if (deathDate < birthDate) {
            birthDateErrString = $t("person.invalidDateRange");
            deathDateErrString = $t("person.invalidDateRange");
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
                <h5 class="modal-title ms-2" id="addFamlilyLabel">{$t("person.title")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <form class="row">
                    <div class="col-12">
                        <label for="personNameInput" class="form-label">{$t("person.name")}</label>
                        <input class="form-control" id="personNameInput" aria-describedby="personNameHelp" bind:value={name} readonly={readOnly} />
                    </div>
                    <div class="mt-3 mb-2">{$t("person.lifeYears")}</div>
                    <div class="col-md-6 mb-2">
                        <input
                            id="birthDateInput"
                            value={dateToMaskedDateStr(birthDate)}
                            use:imask={dateMaskingOpts}
                            on:accept={acceptBirthDate}
                            on:complete={completeBirthDate}
                            class="form-control birthdate-input {birthDateErrString ? 'is-invalid' : ''}"
                            readonly={readOnly}
                            placeholder={$t("person.datePlaceholder")}
                        />
                        <div class="invalid-feedback">{birthDateErrString}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <input
                            id="deathDateInput"
                            value={dateToMaskedDateStr(deathDate)}
                            use:imask={dateMaskingOpts}
                            on:accept={acceptDeathDate}
                            on:complete={completeDeathDate}
                            class="form-control deathdate-input {deathDateErrString ? 'is-invalid' : ''}"
                            readonly={readOnly}
                            placeholder={$t("person.datePlaceholder")}
                        />
                        <div class="invalid-feedback">{deathDateErrString}</div>
                    </div>

                    <div class="col-12 mt-2">
                        <label for="personBioInput" class="form-label">{$t("person.bio")}</label>
                        <textarea class="form-control" rows="6" id="personBioInput" bind:value={bio} readonly={readOnly}></textarea>
                    </div>
                    <div class="col-12 mt-3">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="flexSwitchCheckDefault" bind:checked={pinned} />
                            <label class="form-check-label" for="flexSwitchCheckDefault">{$t("person.pin")}</label>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                {#if !readOnly}
                    <button type="button" class="btn btn-danger me-auto" on:click={() => personRemoved()}>{$t("common.delete")}</button>
                {/if}
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                <button
                    type="button"
                    class="btn btn-primary"
                    disabled={birthDateErrString != null || deathDateErrString != null}
                    on:click={() => personUpdated()}>{$t("common.save")}</button
                >
            </div>
        </div>
    </div>
</div>
