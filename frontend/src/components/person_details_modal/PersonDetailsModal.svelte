<script module lang="ts">
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
    import { t } from "../../i18n";

    type Props = {
        onpersonUpdated?: (payload: UpdatePerson) => void;
        onpersonRemoved?: (id: string) => void;
    };

    let { onpersonUpdated, onpersonRemoved }: Props = $props();

    let modalEl = $state<HTMLElement>(null);
    let birthInputEl = $state<HTMLInputElement>(null);
    let deathInputEl = $state<HTMLInputElement>(null);

    let pinned = $state<boolean>(false);
    let name = $state<string>("");
    let birthDate = $state<Date>(null);
    let deathDate = $state<Date>(null);
    let bio = $state<string>("");
    let id = $state<string>("");
    let readOnly = $state<boolean>(false);

    let birthDateErrString = $state<string>(null);
    let deathDateErrString = $state<string>(null);

    function personUpdated() {
        onpersonUpdated?.({
            id,
            description: {
                type: "CreateNewPerson",
                name,
                birthDate: dateToIsoLocalTime(birthDate),
                deathDate: dateToIsoLocalTime(deathDate),
                bio,
            },
            pin: pinned,
        });

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function personRemoved() {
        onpersonRemoved?.(id);
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function dateToIsoLocalTime(d: Date) {
        if (!d) return null;

        const date = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();

        const dateStr = date < 10 ? "0" + date : date.toString();
        const monthStr = month < 10 ? "0" + month : month.toString();

        return `${year}-${monthStr}-${dateStr}`;
    }

    export function showPersonDetails(p: ShowPerson) {
        id = p.description.id;
        name = p.description.name;
        birthDate = p.description.birthDate ? new Date(p.description.birthDate) : null;
        deathDate = p.description.deathDate ? new Date(p.description.deathDate) : null;
        if (birthInputEl) birthInputEl.value = dateToMaskedDateStr(birthDate) ?? "";
        if (deathInputEl) deathInputEl.value = dateToMaskedDateStr(deathDate) ?? "";
        bio = p.description.bio;
        pinned = p.pin;
        readOnly = p.description.readOnly;

        birthDateErrString = null;
        deathDateErrString = null;

        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    function parseMaskedDateStr(str: string) {
        const [day, month, year] = str.split(".");
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    function dateToMaskedDateStr(date: Date) {
        if (!date) return null;

        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const dayStr = day < 10 ? "0" + day : day.toString();
        const monthStr = month < 10 ? "0" + month : month.toString();

        return [dayStr, monthStr, year.toString()].join(".");
    }

    const dateMaskingOpts = {
        mask: Date,
        lazy: true,
        max: new Date(),
        format: dateToMaskedDateStr,
        parse: parseMaskedDateStr,
    };

    function attachMaskedDateListeners(
        el: HTMLInputElement,
        setErr: (err: string | null) => void,
        setDate: (d: Date) => void,
    ) {
        function onAccept(e: Event) {
            const maskRef = (e as CustomEvent).detail;
            setErr(maskRef.unmaskedValue ? $t("person.incompleteDate") : null);
        }
        function onComplete(e: Event) {
            const maskRef = (e as CustomEvent).detail;
            setErr(null);
            setDate(parseMaskedDateStr(maskRef.value));
            validateLifetimeRange();
        }
        el.addEventListener("accept", onAccept);
        el.addEventListener("complete", onComplete);
        return () => {
            el.removeEventListener("accept", onAccept);
            el.removeEventListener("complete", onComplete);
        };
    }

    $effect(() => {
        if (!birthInputEl) return;
        return attachMaskedDateListeners(
            birthInputEl,
            (err) => (birthDateErrString = err),
            (d) => (birthDate = d),
        );
    });

    $effect(() => {
        if (!deathInputEl) return;
        return attachMaskedDateListeners(
            deathInputEl,
            (err) => (deathDateErrString = err),
            (d) => (deathDate = d),
        );
    });

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
                            bind:this={birthInputEl}
                            id="birthDateInput"
                            value={dateToMaskedDateStr(birthDate)}
                            use:imask={dateMaskingOpts}
                            class="form-control birthdate-input {birthDateErrString ? 'is-invalid' : ''}"
                            readonly={readOnly}
                            placeholder={$t("person.datePlaceholder")}
                        />
                        <div class="invalid-feedback">{birthDateErrString}</div>
                    </div>
                    <div class="col-md-6 mb-2">
                        <input
                            bind:this={deathInputEl}
                            id="deathDateInput"
                            value={dateToMaskedDateStr(deathDate)}
                            use:imask={dateMaskingOpts}
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
                    <button type="button" class="btn btn-danger me-auto" onclick={personRemoved}>{$t("common.delete")}</button>
                {/if}
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                <button
                    type="button"
                    class="btn btn-primary"
                    disabled={birthDateErrString != null || deathDateErrString != null}
                    onclick={personUpdated}>{$t("common.save")}</button
                >
            </div>
        </div>
    </div>
</div>
