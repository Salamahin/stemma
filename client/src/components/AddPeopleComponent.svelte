<script context="module" lang="ts">
    import { NewPerson, Stemma, StoredPerson } from "../model";
    import Select from "svelte-select";

    export type PersonChangedEvent = { index: number; descr: NewPerson };
</script>

<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { StemmaIndex } from "../stemmaIndex";
    import ClearIcon from "./ClearIconTranslated.svelte";

    const dispatch = createEventDispatcher();

    export let maxPeopleCount: number;
    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;

    let selectedNames: string[] = [""];
    let namesakes: string[][] = [[]];
    let selectedIds: string[] = [""];
    let selectedBirthDays: string[] = [""];
    let selectedDeathDays: string[] = [""];

    let peopleNames: string[] = [];
    let clearIcon = ClearIcon;

    function updateName(personIndex: number, name: string) {
        selectedNames[personIndex] = name;
        namesakes[personIndex] = stemmaIndex.namesakes(name);
        idChanged(personIndex, namesakes[personIndex][0]);
    }

    function idChanged(personIndex: number, value: string) {
        selectedIds[personIndex] = value;

        if (!value || value.length == 0) {
            selectedBirthDays[personIndex] = "";
            selectedDeathDays[personIndex] = "";
        } else {
            let sp = stemmaIndex.get(value);
            selectedBirthDays[personIndex] = sp.birthDate;
            selectedDeathDays[personIndex] = sp.deathDate;
        }
    }

    $: peopleNames = [...new Set(stemma.people.map((p) => p.name))];
    $: {
        let filteredNames: string[] = [];
        let filteredBirthDays: string[] = [];
        let filteredDeathDays: string[] = [];
        let filteredIds: string[] = [];
        let filteredNamesakes: string[][] = [];

        for (let i = 0; i < selectedNames.length; i++) {
            if (selectedNames[i].length != 0) {
                filteredNames.push(selectedNames[i]);
                filteredBirthDays.push(selectedBirthDays[i]);
                filteredDeathDays.push(selectedDeathDays[i]);
                filteredIds.push(selectedIds[i]);
                filteredNamesakes.push(namesakes[i]);
            }
        }

        if (filteredNames.length < maxPeopleCount) {
            filteredNames.push("");
            filteredBirthDays.push("");
            filteredDeathDays.push("");
            filteredIds.push("");
            filteredNamesakes.push([]);
        }

        

        selectedNames = [...filteredNames];
        selectedBirthDays = [...filteredBirthDays];
        selectedDeathDays = [...filteredDeathDays];
        selectedIds = [...filteredIds];
        namesakes = [...filteredNamesakes];
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
            {#each selectedNames as name, i}
                <tr>
                    <td style="min-width:300px">
                        <Select
                            value={name}
                            items={peopleNames}
                            isCreatable={true}
                            isClearable={true}
                            placeholder="Имя..."
                            on:select={(e) => updateName(i, e.detail.value)}
                            on:clear={() => updateName(i, "")}
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
                            on:change={() => idChanged(i, document.getElementById(`id_selector_${i}`).value)}
                            disabled={selectedNames[i] === ""}
                            value={selectedIds[i]}
                        >
                            <option value={""}>Новый</option>
                            <optgroup label="Существующий">
                                {#each namesakes[i] as ns, nsIdx}
                                    <option value={ns} selected={nsIdx == 0 ? true : false}>{ns}</option>
                                {/each}
                                <option>Выбрать...</option>
                            </optgroup>
                        </select>
                    </td>
                    <td>
                        <input class="form-control" type="date" value={selectedBirthDays[i]} disabled={selectedIds[i] === ""} />
                    </td>
                    <td>
                        <input class="form-control" type="date" value={selectedDeathDays[i]} disabled={selectedIds[i] === ""} />
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
