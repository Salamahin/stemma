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

    let nullPerson = new PersonDescription("", null, null);

    let people: PersonDescription[] = [nullPerson];

    function onPersonChanged(
        personIndex: number,
        name: string,
        birthDate: string,
        deathDate: string
    ) {
        let newP = new PersonDescription(name, birthDate, deathDate);

        people[personIndex] = newP;
        let nonEmptyPeople = people.filter((p) => !isEqual(p, nullPerson));
        people =
            nonEmptyPeople.length < maxPeopleCount
                ? [...nonEmptyPeople, nullPerson]
                : nonEmptyPeople;
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
                    <td
                        ><input
                            type="text"
                            class="form-control"
                            placeholder="Иванов Виталий Валерьевич"
                            value={person.name}
                            on:input={(e) =>
                                onPersonChanged(i, e.target.value, null, null)}
                        /></td
                    >
                    <td
                        ><input
                            class="form-control"
                            type="date"
                            value={person.birthDate}
                        /></td
                    >
                    <td
                        ><input
                            class="form-control"
                            type="date"
                            value={person.deathDate}
                        /></td
                    >
                    <td>
                        <button
                            type="button"
                            class="btn btn-outline-primary disabled"
                            >Следующее &raquo;</button
                        >
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
