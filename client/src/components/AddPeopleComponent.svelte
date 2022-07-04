<script lang="ts">
    import isEqual from "lodash.isequal";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    export let maxPeopleCount: number;

    export class PersonDescription {
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

    interface PersonSelection {
        current(): PersonDescription;
        hasMore(): boolean;
        isEmpty(): boolean;
        replace(variants: PersonDescription[]): PersonSelection;
    }

    class EmptyPersonSelection implements PersonSelection {
        replace(variants: PersonDescription[]) {
            return this;
        }

        hasMore(): boolean {
            return false;
        }
        current(): PersonDescription {
            return nullPerson;
        }
        isEmpty() {
            return true;
        }
    }

    class NonEmptyPersonSelection implements PersonSelection {
        private selected: number;
        private variants: PersonDescription[];

        constructor(pd: PersonDescription) {
            this.selected = 0;
            this.variants = [pd];
        }

        current(): PersonDescription {
            return this.variants[this.selected];
        }

        hasMore(): boolean {
            return this.variants.length > 1;
        }

        next(): PersonDescription {
            if (this.selected++ > this.variants.length) this.selected = 0;
            return this.variants[this.selected];
        }

        replace(variants: PersonDescription[]) {
            this.variants = [this.current(), ...variants];
            this.selected = 0;
            return this;
        }

        isEmpty() {
            return false;
        }
    }

    let selectedPeople: PersonSelection[] = [new EmptyPersonSelection()];

    function onPersonChanged(personIndex: number, name: string, birthDate: string, deathDate: string) {
        let newP = new PersonDescription(name, birthDate, deathDate);

        selectedPeople[personIndex] = isEqual(newP, nullPerson) ? new EmptyPersonSelection() : new NonEmptyPersonSelection(newP);
        let nonEmptySelections = selectedPeople.filter((selection) => !selection.isEmpty());

        selectedPeople = nonEmptySelections.length < maxPeopleCount ? [...nonEmptySelections, new EmptyPersonSelection()] : nonEmptySelections;

        dispatch(
            "descriptionAdded",
            nonEmptySelections.map((selection) => selection.current())
        );
    }

    export function propose(personIndex: number, descr: PersonDescription[]) {
        selectedPeople[personIndex] = selectedPeople[personIndex].replace(descr);
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
            {#each selectedPeople as ps, i}
                <tr>
                    <td>
                        <input
                            type="text"
                            class="form-control"
                            placeholder="Иванов Виталий Валерьевич"
                            value={ps.current().name}
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
                            value={ps.current().birthDate}
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
                            value="{ps.current().deathDate},"
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
                        <button type="button" class="btn btn-outline-primary {ps.hasMore() ? '' : 'disabled'}" on:click={dispatch("next", i)}
                            >Следующее &raquo;</button
                        >
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
