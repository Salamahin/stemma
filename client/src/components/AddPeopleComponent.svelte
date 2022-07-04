<script lang="ts">
    import isEqual from "lodash.isequal";

    export let maxPeopleCount: number;

    class PersonDescription {
        name: string;
        birthDate: string;
        deathDate: string;

        constructor(name, birhtDate, deathDate) {
            this.name = name;
            this.birthDate = birhtDate;
            this.deathDate = deathDate;
        }
    }

    let nullPerson = new PersonDescription("", "", "");

    let people: PersonDescription[] = [nullPerson];

    function onPersonChanged(personIndex: number, name: string, birthDate: string, deathDate: string) {
        let newP = new PersonDescription(name, birthDate, deathDate);
        console.log(newP);
        console.log(personIndex);

        people[personIndex] = newP;
        let nonEmptyPeople = people.filter((p) => !isEqual(p, nullPerson));
        people = nonEmptyPeople.length < maxPeopleCount ? [...nonEmptyPeople, nullPerson] : nonEmptyPeople;
    }
</script>

<div>
    <table class="table">
        <thead>
            <tr>
                <th scope="col">Имя</th>
                <th scope="col">Дата рождения</th>
                <th scope="col">Дата смерти</th>
                <th scope="col">Выбор древа</th>
            </tr>
        </thead>
        <tbody>
            {#each people as person, i}
                <tr>
                    <td>
                        <input
                            type="text"
                            class="form-control"
                            placeholder="Иванов Виталий Валерьевич"
                            value={person.name}
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
                            value={person.birthDate}
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
                            value="{person.deathDate},"
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
                    <td>
                        <button type="button" class="btn btn-outline-primary disabled">Следующее &raquo;</button>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
