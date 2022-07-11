<script context="module" lang="ts">
    import { NewPerson, Stemma, StoredPerson } from "../model";
    import Select from "svelte-select";

    export type PersonChangedEvent = { index: number; descr: NewPerson };
</script>

<script lang="ts">
    import isEqual from "lodash.isequal";
    import clone from "lodash.clone";
    import { createEventDispatcher } from "svelte";
    import { Lineage } from "../generation";
    import ClearIcon from "./ClearIconTranslated.svelte";

    const dispatch = createEventDispatcher();

    export let maxPeopleCount: number;
    export let stemma: Stemma;
    export let lineage: Lineage;

    let nullPerson: NewPerson = {
        name: "",
        birthDate: "",
        deathDate: "",
    };

    let selectedPeople: (NewPerson | StoredPerson)[] = [nullPerson];
    let selectedPeopleCount = 0;

    let peopleNames: string[] = [];
    let clearIcon = ClearIcon;

    function clearPerson(personIndex: number) {
        selectedPeople[personIndex] = clone(nullPerson);
        if (--selectedPeopleCount == 1) selectedPeople = [...selectedPeople, nullPerson];
    }

    function updateName(personIndex: number, name: string) {
        let person = clone(selectedPeople[personIndex]);
        person.name = name;
        selectedPeople[personIndex] = person;

        if (++selectedPeopleCount < maxPeopleCount) selectedPeople = [...selectedPeople, nullPerson];
    }

    function updateId(personIndex: number, id?: string) {
        console.log("update id")
        console.log(number)
        let person = clone(selectedPeople[personIndex]);

        if (!id || !id.length)
            person = {
                name: person.name,
                birthDate: person.birthDate,
                deathDate: person.deathDate,
            };
        else
            person = {
                id: id,
                name: person.name,
                birthDate: person.birthDate,
                deathDate: person.deathDate,
            };

        selectedPeople[personIndex] = person;
    }

    function updateBirthDate(personIndex: number, value?: string) {
        let person = clone(selectedPeople[personIndex]);
        person.birthDate = value;
        selectedPeople[personIndex] = person;
    }

    function updateDeathDate(personIndex: number, value?: string) {
        let person = clone(selectedPeople[personIndex]);
        person.deathDate = value;
        selectedPeople[personIndex] = person;
    }

    function shouldShow(sp: NewPerson | StoredPerson, idx: number) {
        let show = (!isEqual(sp, nullPerson) && idx < selectedPeople.length) || (idx == selectedPeople.length - 1 && selectedPeopleCount < maxPeopleCount);
        return show;
    }

    $: peopleNames = [...new Set(stemma.people.map((p) => p.name))];
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
            {#each selectedPeople as sp, i}
                <!-- unfortunately for some reason dynamical removal of the Select component is not working properly. So there is an ugly hack
            that would constantly increasy selectedPeople accumulator until it eventyally contains non null members
            constant adding-removing would have a linear overhead, but i wont expect a family of such size -->
                {#if shouldShow(sp, i)}
                    <tr>
                        <td style="min-width:300px">
                            <Select
                                items={peopleNames}
                                isCreatable={true}
                                isClearable={true}
                                placeholder="Имя..."
                                on:select={(e) => updateName(i, e.detail.value)}
                                on:clear={() => clearPerson(i)}
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
                            <select class="form-select" aria-label="namesake select" on:change={(e) => updateId(i, e.detail)}>
                                <option value={null}>Новый</option>
                                <optgroup label="Существующий">
                                    {#each lineage.namesakes(sp.name) as ns, nsIdx}
                                        <option value={ns} selected={nsIdx == 0 ? true : false}>{ns}</option>
                                    {/each}
                                    <option>Выбрать...</option>
                                </optgroup>
                            </select>
                        </td>
                        <td>
                            <input class="form-control" type="date" value={sp.birthDate} on:input={(e) => updateBirthDate(i, e.detail)} disabled={"id" in sp} />
                        </td>
                        <td>
                            <input class="form-control" type="date" value={sp.birthDate} on:input={(e) => updateDeathDate(i, e.detail)} disabled={"id" in sp} />
                        </td>
                    </tr>
                {/if}
            {/each}
        </tbody>
    </table>
</div>
