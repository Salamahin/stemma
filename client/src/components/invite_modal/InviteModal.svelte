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

    function nameChanged(newName: string) {
        namesakes = [...stemmaIndex.namesakes(newName).filter((p) => !p.readOnly)];
        if (carousel) carousel.goTo(0, { animated: false });
        dispatch("selected", namesakes[0]);
        selectedName = newName;
    }

    export function reset() {
        namesakes = [];
        selectedName = null;
    }

    $: if (stemma) peopleNames = [...new Set(stemma.people.map((p) => p.name))];

    export function showInvintation() {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" id="personDetailsModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title ms-2">Пригласить</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div class="modal-body">
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
                        <Carousel on:pageChange={(e) => dispatch("selected", namesakes[e.detail])} bind:this={carousel}>
                            {#each namesakes as ns, i}
                                <div class="d-flex flex-column">
                                    <VisualPersonDescription selectedPerson={ns} {stemmaIndex} chartId={`ns_chart_${i}`} />
                                </div>
                            {/each}
                        </Carousel>
                    {/if}
                {/key}

                <input type="email" class="form-control" id="exampleInputEmail1" aria-describedby="emailHelp" placeholder="Введите почту" />
                <div class="input-group mb-3">
                    <input type="text" class="form-control" aria-label="inviteLink" aria-describedby="button-addon2" readonly />
                    <button class="btn btn-outline-secondary" type="button" id="button-addon2">Скопировать</button>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
            </div>
        </div>
    </div>
</div>
