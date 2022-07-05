<script lang="ts">
    import { NewPerson, Stemma, StoredPerson } from "../model";
    import isEqual from "lodash.isequal";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let maxPeopleCount: number;
    export let stemma: Stemma;

    let nullPerson: NewPerson = {
        name: "",
        birthDate: "",
        deathDate: "",
    };

    class PersonSelector {
        private _newP: NewPerson;
        private _namesakes: StoredPerson[];
        private _current: NewPerson | StoredPerson;

        constructor(newP: NewPerson, namesakes: StoredPerson[]) {
            this._newP = newP;
            this._current = newP;
            this._namesakes = namesakes;
        }

        current(): NewPerson | StoredPerson {
            return this._current;
        }

        select(n: StoredPerson) {
            this._current = n;
            return this;
        }

        reset() {
            this._current = this._newP;
            return this;
        }

        namesakes(): StoredPerson[] {
            return this._namesakes;
        }

        isEmpty(): boolean {
            return isEqual(this._newP, nullPerson);
        }
    }

    let selectedPeople: PersonSelector[] = [new PersonSelector(nullPerson, [])];
    let namesakesDescr: string[] = [""];

    function onPersonChanged(personIndex: number, name: string, birthDate: string, deathDate: string) {
        let newP = {
            name: name,
            birthDate: birthDate,
            deathDate: deathDate,
        };

        let namesakes = stemma.people.filter((p) => p.name == newP.name);

        let newPs = new PersonSelector(newP, namesakes);
        selectedPeople[personIndex] = newPs;

        selectedPeople = [...selectedPeople.filter((p) => !p.isEmpty()), new PersonSelector(nullPerson, [])];
    }

    function fullDescription(ns: StoredPerson) {
        let selectedPersonId = ns.id;

        let idToName = new Map(stemma.people.map((p) => [p.id, p.name]));

        let parents = stemma.families.filter((f) => f.children.includes(selectedPersonId)).flatMap((f) => f.parents);
        let children = stemma.families.filter((f) => f.parents.includes(selectedPersonId)).flatMap((f) => f.children);

        let parentsNames = parents.length ? `, родители: ${parents.map((pId) => idToName.get(pId)).join(",")}` : "";
        let childrenNames = children.length ? `, дети: ${children.map((pId) => idToName.get(pId)).join(",")}` : "";

        return `[${ns.id}] ${ns.name}${parentsNames}${childrenNames}`;
    }

    function shortDescription(ns: StoredPerson) {
        return `[${ns.id}]`;
    }

    $: namesakesDescr = selectedPeople.map((x) => {
        let s = x.current();
        return "id" in s ? shortDescription(s) : "Новый";
    });
</script>

<div>
    <table class="table table-sm">
        <thead>
            <tr>
                <th scope="col">Имя</th>
                <th scope="col">Дата рождения</th>
                <th scope="col">Дата смерти</th>
                <th scope="col">Выбор тезки</th>
            </tr>
        </thead>
        <tbody>
            {#each selectedPeople as person, i}
                <tr>
                    <td>
                        <input
                            type="text"
                            class="form-control"
                            value={person.current().name}
                            id={"person_name_" + i}
                            on:input={(e) =>
                                onPersonChanged(
                                    i,
                                    e.target.value,
                                    document.getElementById("person_birthDate_" + i).value,
                                    document.getElementById("person_deathDate_" + i).value
                                )}
                        />
                    </td>
                    <td>
                        <input
                            class="form-control"
                            type="date"
                            value={person.current().birthDate}
                            id={"person_birthDate_" + i}
                            on:input={(e) =>
                                onPersonChanged(
                                    i,
                                    document.getElementById("person_name_" + i).value,
                                    e.target.value,
                                    document.getElementById("person_deathDate_" + i).value
                                )}
                        />
                    </td>
                    <td>
                        <input
                            class="form-control"
                            type="date"
                            value="{person.current().deathDate},"
                            id={"person_deathDate_" + i}
                            on:input={(e) =>
                                onPersonChanged(
                                    i,
                                    document.getElementById("person_name_" + i).value,
                                    document.getElementById("person_birthDate_" + i).value,
                                    e.target.value
                                )}
                        />
                    </td>
                    <td style="min-width: 120px;">
                        <div class="btn-group dropstart {person.namesakes().length ? '' : 'visually-hidden'}" style="width:100%">
                            <button type="button" class="btn btn-danger dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                                {namesakesDescr[i]}
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#" on:click={(e) => (selectedPeople[i] = selectedPeople[i].reset())}>Новый</a></li>
                                {#each person.namesakes() as namesake}
                                    <li>
                                        <a class="dropdown-item" href="#" on:click={(e) => (selectedPeople[i] = selectedPeople[i].select(namesake))}
                                            >{fullDescription(namesake)}</a
                                        >
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
