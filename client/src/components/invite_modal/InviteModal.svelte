<script context="module" lang="ts">
    export type CreateInviteLink = {
        personId: string;
        email: string;
    };
</script>

<script lang="ts">
    import Select from "svelte-select";
    import * as bootstrap from "bootstrap";
    import { Stemma, PersonDescription } from "../../model";
    import ClearIcon from "../misc/ClearIconTranslated.svelte";
    import { createEventDispatcher } from "svelte";
    import { StemmaIndex } from "../../stemmaIndex";
    import PersonSelector from "../misc/PersonSelector.svelte";

    let modalEl;

    export let stemmaIndex: StemmaIndex;
    export let stemma: Stemma;

    let namesakes: PersonDescription[] = [];
    let selectedPerson: PersonDescription;
    let peopleNames: string[];
    let email;
    let inviteLink = "";

    let clearIcon = ClearIcon;
    let dispatch = createEventDispatcher();

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

    $: if (stemma) peopleNames = [...new Set(stemma.people.map((p) => p.name))];
</script>

<div class="modal fade" id="personDetailsModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title ms-2">Пригласить</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
                <div class="container h-100">
                    <div class="d-flex flex-column h-100">
                        <div class="flex-shrink-1">
                            <label for="personName" class="form-label">Пользователь</label>
                            <Select
                                id="personName"
                                placeholder="Иванов Иван Иванович"
                                items={peopleNames}
                                isSearchable={true}
                                isCreatable={false}
                                on:select={(e) => nameChanged(e.detail.value)}
                                on:clear={() => reset()}
                                ClearIcon={clearIcon}
                                hideEmptyState={true}
                                value={selectedPerson ? selectedPerson.name : null}
                            />
                        </div>
                        <div class="flex-grow-1 mt-2" style="min-height:400px">
                            <PersonSelector people={namesakes} {stemmaIndex} on:select={(e) => (selectedPerson = e.detail)} />
                        </div>
                        <div class="flex-shrink-1 mb-2">
                            <div class="mt-2">
                                <label for="emainInput" class="form-label">Email-адрес</label>
                                <input type="email" class="form-control" id="emainInput" placeholder="name@example.com" bind:value={email} />
                            </div>

                            <label for="outline" class="form-label mt-2">Ссылка для приглашения</label>
                            <div class="input-group">
                                <button
                                    class="btn btn-outline-primary"
                                    type="button"
                                    disabled={!email || !selectedPerson}
                                    on:click={(e) => dispatch("invite", { personId: selectedPerson.id, email: email })}>Создать</button
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
                                    disabled={inviteLink == undefined || !inviteLink.length}
                                    on:click={() => navigator.clipboard.writeText(inviteLink)}><i class="bi bi-clipboard" /></button
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
            </div>
        </div>
    </div>
</div>

<style>
    .control :global(svg) {
        width: 100%;
        height: 100%;
        color: #fff;
        border: 2px solid #fff;
        border-radius: 32px;
    }
</style>
