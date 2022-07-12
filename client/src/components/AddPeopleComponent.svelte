<script context="module" lang="ts">
    import { NewPerson, Stemma, StoredPerson } from "../model";
    import Select from "svelte-select";

    export type PersonChangedEvent = { index: number; descr: NewPerson };
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

    class PersonDetails {
        name: string = "";
        namesakes: string[] = [];
        birthDate: string = "";
        deathDate: string = "";
        id: string = "";

        isNew() {
            return this.id == "";
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
                obj.id = this.id;
            }

            return obj;
        }
    }

    let personDetails: PersonDetails[] = [new PersonDetails()];
    let peopleNames: string[] = [""];
    let clearIcon = ClearIcon;

    export function reset() {
        personDetails = [new PersonDetails()];
    }

    function nameChanged(personIndex: number, name: string) {
        let pd = personDetails[personIndex];
        pd.name = name;
        pd.namesakes = stemmaIndex.namesakes(name);
        idChanged(pd, personIndex, pd.namesakes[0]);
    }

    function idChanged(pd: PersonDetails, personIndex: number, value: string) {
        if (!value || !value.length) {
            pd.id = "";
            pd.birthDate = "";
            pd.deathDate = "";
        } else {
            let sp = stemmaIndex.get(value);
            pd.id = value;
            pd.birthDate = sp.birthDate;
            pd.deathDate = sp.deathDate;
        }

        personDetails[personIndex] = pd;
    }

    $: peopleNames = [...new Set(stemma.people.map((p) => p.name))];
    $: {
        let clearedPersonDetails = personDetails.filter((pd) => !pd.isEmpty());
        if (clearedPersonDetails.length < maxPeopleCount) clearedPersonDetails = [...clearedPersonDetails, new PersonDetails()];

        personDetails = [...clearedPersonDetails];
        console.log(personDetails);

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
                                return option.isCreator ? `Совпадений не найдено` : option["label"];
                            }}
                            hideEmptyState={true}
                        />
                    </td>
                    <td>
                        <select
                            id={`id_selector_${i}`}
                            class="form-select"
                            aria-label="namesake select"
                            on:change={() => idChanged(pd, i, document.getElementById(`id_selector_${i}`).value)}
                            value={pd.id}
                            disabled={pd.isEmpty()}
                        >
                            <option value={""}>Новый</option>
                            {#if pd.namesakes.length}
                                <optgroup label="Существующий">
                                    {#each pd.namesakes as ns, nsIdx}
                                        <option value={ns} selected={nsIdx == 0 ? true : false}>{ns}</option>
                                    {/each}
                                    <option>Выбрать...</option>
                                </optgroup>
                            {/if}
                        </select>
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
