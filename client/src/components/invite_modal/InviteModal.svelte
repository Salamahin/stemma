<script context="module" lang="ts">
    export type CreateInviteLink = {
        personId: string;
        email: string;
    };
</script>

<script lang="ts">
    import Select from "svelte-select";
    import * as bootstrap from "bootstrap";
    import { Stemma, StoredPerson } from "../../model";
    import ClearIcon from "../misc/ClearIconTranslated.svelte";
    import { createEventDispatcher } from "svelte";
    import { StemmaIndex } from "../../stemmaIndex";
    import Carousel from "svelte-carousel";
    import VisualPersonDescription from "../misc/VisualPersonDescription.svelte";

    let modalEl;

    export let stemmaIndex: StemmaIndex;
    export let stemma: Stemma;

    let namesakes: StoredPerson[] = [];
    let peopleNames: string[];

    let clearIcon = ClearIcon;
    let carousel;

    let dispatch = createEventDispatcher();

    let selectedName;
    let selectedPersonId;
    let email;
    let inviteLink = "";

    function nameChanged(newName: string) {
        namesakes = [...stemmaIndex.namesakes(newName).filter((p) => !p.readOnly)];
        if (carousel) carousel.goTo(0, { animated: false });
        selectedName = newName;
    }

    function reset() {
        namesakes = [];
        selectedName = null;
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
                <label for="personName" class="form-label">Пользователь</label>
                <Select
                    id="personName"
                    placeholder="Иванов Иван Иванович"
                    items={peopleNames}
                    isSearchable={true}
                    isCreatable={true}
                    on:select={(e) => nameChanged(e.detail.value)}
                    on:clear={() => reset()}
                    ClearIcon={clearIcon}
                    getOptionLabel={(option, filterText) => {
                        return option.isCreator ? `Создать "${filterText}"` : option["label"];
                    }}
                    hideEmptyState={true}
                    value={selectedName}
                />
                {#key namesakes}
                    {#if namesakes.length}
                        <Carousel
                            on:pageChange={(e) => (selectedPersonId = namesakes[e.detail].id)}
                            bind:this={carousel}
                            arrows={namesakes.length > 1}
                            duration={0}
                        >
                            {#each namesakes as ns, i}
                                <div class="d-flex flex-column">
                                    <VisualPersonDescription selectedPerson={ns} {stemmaIndex} chartId={`ns_chart_${i}`} />
                                </div>
                            {/each}
                        </Carousel>
                    {:else}
                        <div style="height:320px" />
                    {/if}
                {/key}

                <div class="mt-2">
                    <label for="emainInput" class="form-label">Email-адрес</label>
                    <input type="email" class="form-control" id="emainInput" placeholder="name@example.com" bind:value={email} />
                </div>

                <label for="outline" class="form-label mt-2">Ссылка для приглашения</label>
                <div class="input-group">
                    <button
                        class="btn btn-outline-primary"
                        type="button"
                        disabled={!email || !selectedName}
                        on:click={(e) => dispatch("invite", { personId: selectedPersonId, email: email })}>Создать</button
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
                    <button class="btn btn-outline-secondary" type="button" disabled={inviteLink == undefined || !inviteLink.length}
                        ><i class="bi bi-clipboard" /></button
                    >
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
            </div>
        </div>
    </div>
</div>
