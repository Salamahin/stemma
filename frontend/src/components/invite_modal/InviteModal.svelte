<script module lang="ts">
    export type CreateInviteLink = {
        personId: string;
        email: string;
    };
</script>

<script lang="ts">
    import Select from "svelte-select";
    import * as bootstrap from "bootstrap";
    import type { Stemma, PersonDescription } from "../../model";
    import ClearIcon from "../misc/ClearIconTranslated.svelte";
    import { StemmaIndex } from "../../stemmaIndex";
    import PersonSelector from "../misc/PersonSelector.svelte";
    import { t } from "../../i18n";

    type Props = {
        stemmaIndex: StemmaIndex;
        stemma: Stemma;
        oninvite?: (payload: CreateInviteLink) => void;
    };

    let { stemmaIndex, stemma, oninvite }: Props = $props();

    let modalEl = $state<HTMLElement>(null);

    let namesakes = $state<PersonDescription[]>([]);
    let selectedPerson = $state<PersonDescription>(null);
    type SelectItem = { label: string; value: string };
    let email = $state<string>(null);
    let inviteLink = $state("");

    const peopleNames = $derived(
        stemma ? [...new Set(stemma.people.map((p) => p.name))] : []
    );

    const peopleItems = $derived<SelectItem[]>(
        peopleNames.map((name) => ({ label: name, value: name }))
    );

    const selectedItem = $derived<SelectItem | null>(
        selectedPerson ? { label: selectedPerson.name, value: selectedPerson.name } : null
    );

    function nameChanged(newName: string) {
        namesakes = [...stemmaIndex.namesakes(newName).filter((p) => !p.readOnly)];
    }

    function reset() {
        namesakes = [];
        selectedPerson = null;
        email = null;
        inviteLink = "";
    }

    export function showInvintation() {
        reset();
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    export function setInviteLink(link: string) {
        inviteLink = link;
    }

    function handleSelect(e: any) {
        const detail = e?.detail as SelectItem | undefined;
        const value = detail?.value ?? detail?.label ?? "";
        if (value) nameChanged(value);
    }
</script>

<div class="modal fade" id="personDetailsModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title ms-2">{$t("invite.title")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <div class="container h-100">
                    <div class="d-flex flex-column h-100">
                        <div class="flex-shrink-1">
                            <label for="personName" class="form-label">{$t("invite.user")}</label>
                            <Select
                                id="personName"
                                placeholder={$t("family.namePlaceholder")}
                                items={peopleItems}
                                searchable={true}
                                on:select={handleSelect}
                                on:clear={() => reset()}
                                hideEmptyState={true}
                                value={selectedItem}
                            >
                                <svelte:fragment slot="clear-icon">
                                    <ClearIcon />
                                </svelte:fragment>
                            </Select>
                        </div>
                        <div class="flex-grow-1 mt-2" style="min-height:400px">
                            <PersonSelector people={namesakes} {stemmaIndex} onselect={(p) => (selectedPerson = p as PersonDescription)} />
                        </div>
                        <div class="flex-shrink-1 mb-2">
                            <div class="mt-2">
                                <label for="emainInput" class="form-label">{$t("invite.email")}</label>
                                <input type="email" class="form-control" id="emainInput" placeholder="name@example.com" bind:value={email} />
                            </div>

                            <label for="outline" class="form-label mt-2">{$t("invite.linkLabel")}</label>
                            <div class="input-group">
                                <button
                                    class="btn btn-outline-primary"
                                    type="button"
                                    disabled={!email || !selectedPerson}
                                    onclick={() => oninvite?.({ personId: selectedPerson.id, email })}>{$t("invite.create")}</button
                                >
                                <input
                                    type="text"
                                    id="inviteLink"
                                    class="form-control"
                                    aria-label="inviteLink"
                                    aria-describedby="button-addon2"
                                    readonly
                                    value={inviteLink}
                                />
                                <button
                                    class="btn btn-outline-secondary"
                                    type="button"
                                    aria-label="Copy invitation link"
                                    disabled={inviteLink == undefined || !inviteLink.length}
                                    onclick={() => navigator.clipboard.writeText(inviteLink)}><i class="bi bi-clipboard"></i></button
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.close")}</button>
            </div>
        </div>
    </div>
</div>
