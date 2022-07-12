<script context="module" lang="ts">
    import { NewPerson, Stemma, StoredPerson } from "../model";
    import Select from "svelte-select";

    export type PersonChoice = { index: number; personIds: string[] };
</script>

<script lang="ts">
    import { createEventDispatcher, onDestroy } from "svelte";
    import { StemmaIndex } from "../stemmaIndex";
    import ClearIcon from "./ClearIconTranslated.svelte";
    import { prop_dev } from "svelte/internal";

    const dispatch = createEventDispatcher();

    export let maxPeopleCount: number;
    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;

    type IdSelection = {
        value: string;
        group: string;
        label: string;
    };

    const NewId: IdSelection = {
        value: "",
        group: null,
        label: "Новый",
    };

    const SelectId: IdSelection = {
        value: null,
        group: "Существующий",
        label: "Выбрать...",
    };

    class PersonDetails {
        name: string = "";
        namesakes: IdSelection[] = [NewId];
        birthDate: string = "";
        deathDate: string = "";
        id: IdSelection = NewId;

        isNew() {
            return this.id.value == "";
        }

        isEmpty() {
            return this.name == "";
        }

        toStruct() {
            let obj = {};

            if (this.isNew()) {
                obj.name = this.name;
                obj.deathDate = this.deathDate;
                obj.birthDate = this.birthDate;
            } else {
                obj.id = this.id.value;
            }

            return obj;
        }
    }

    function createId(id: string) {
        return { value: id, group: "Существующий", label: id };
    }

    let personDetails: PersonDetails[] = [new PersonDetails()];
    let peopleNames: string[] = [""];

    let clearIcon = ClearIcon;

    export function reset() {
        personDetails = [new PersonDetails()];
    }

    export function set(personIndex: number, person: StoredPerson) {
        let pd = personDetails[personIndex];

        pd.name = person.name;
        pd.namesakes = [NewId, ...stemmaIndex.namesakes(person.name).map((id) => createId(id)), SelectId];
        pd.id = createId(person.id);
        pd.birthDate = person.birthDate;
        pd.deathDate = person.deathDate;

        personDetails[personIndex] = pd;
    }

    function nameChanged(personIndex: number, name: string) {
        let pd = personDetails[personIndex];

        let namesakes = stemmaIndex.namesakes(name);
        let selectAppendinx = namesakes.length > 1 ? [SelectId] : []

        pd.name = name;
        pd.namesakes = [NewId, ...stemmaIndex.namesakes(name).map((id) => createId(id)), ...selectAppendinx];

        idChanged(pd, personIndex, namesakes.length ? pd.namesakes[1] : pd.namesakes[0]);
    }

    function idChanged(pd: PersonDetails, personIndex: number, selection: IdSelection) {
        if (selection.value === null) {
            dispatch("choose", { index: personIndex, personIds: pd.namesakes.slice(1, pd.namesakes.length - 1).map((p) => p.value) });
            return;
        }

        if (selection.value === "") {
            pd.id = NewId;
            pd.birthDate = "";
            pd.deathDate = "";
        } else {
            let sp = stemmaIndex.get(selection.value);
            pd.id = selection;
            pd.birthDate = sp.birthDate;
            pd.deathDate = sp.deathDate;
        }

        personDetails[personIndex] = pd;
    }

    $: peopleNames = [...new Set(stemma.people.map((p) => p.name))];
    $: {
        let clearedPersonDetails = personDetails.filter((pd) => !pd.isEmpty());
        let appendix = clearedPersonDetails.length < maxPeopleCount ? [new PersonDetails()] : [] 

        personDetails = [...clearedPersonDetails, ...appendix];

        dispatch(
            "selected",
            clearedPersonDetails.map((pd) => pd.toStruct())
        );
    }
</script>

<div>
    <table class="table">
        <thead>
            <tr>
                <th scope="col">Имя</th>
                <th scope="col">Режим создания</th>
                <th scope="col">Дата рождения</th>
                <th scope="col">Дата смерти</th>
            </tr>
        </thead>
        <tbody>
            {#each personDetails as pd, i}
                <tr>
                    <td style="min-width:300px">
                        <Select
                            value={pd.name}
                            items={peopleNames}
                            isCreatable={true}
                            isClearable={true}
                            placeholder="Имя..."
                            on:select={(e) => nameChanged(i, e.detail.value)}
                            on:clear={() => nameChanged(i, "")}
                            listAutoWidth={false}
                            containerStyles="height:38px"
                            ClearIcon={clearIcon}
                            getOptionLabel={(option, filterText) => {
                                return option.isCreator ? `Нажмите Enter для подтверждения` : option["label"];
                            }}
                            hideEmptyState={true}
                        />
                    </td>
                    <td>
                        <Select
                            value={pd.id}
                            items={pd.namesakes}
                            groupBy={(e) => e.group}
                            isSearchable={false}
                            isClearable={false}
                            on:select={(e) => idChanged(pd, i, e.detail)}
                            containerStyles="height:38px"
                            listAutoWidth={false}
                            isDisabled={pd.namesakes.length == 1}
                            indicatorSvg={'<svg width="100%" height="100%" viewBox="0 0 20 20" focusable="false" aria-hidden="true" transform="translate(0, -6)"> <path d="M4.516 7.548c0.436-0.446 1.043-0.481 1.576 0l3.908 3.747 3.908-3.747c0.533-0.481 1.141-0.446 1.574 0 0.436 0.445 0.408 1.197 0 1.615-0.406 0.418-4.695 4.502-4.695 4.502-0.217 0.223-0.502 0.335-0.787 0.335s-0.57-0.112-0.789-0.335c0 0-4.287-4.084-4.695-4.502s-0.436-1.17 0-1.615z" /> </svg>'}
                        />
                    </td>
                    <td>
                        <input class="form-control" type="date" value={pd.birthDate} disabled={!pd.isNew() || pd.isEmpty()} />
                    </td>
                    <td>
                        <input class="form-control" type="date" value={pd.deathDate} disabled={!pd.isNew() || pd.isEmpty()} />
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
