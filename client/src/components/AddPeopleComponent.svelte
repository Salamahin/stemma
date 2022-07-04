<script lang="ts">
    import isEqual from "lodash.isequal";
    import { createEventDispatcher } from "svelte";
    import { NewPerson, StoredPerson } from "../model";
    import autocomplete from "autocompleter";

    const dispatch = createEventDispatcher();
    export let maxPeopleCount: number;

    let nullPerson: NewPerson = {
        name: "",
        birthDate: "",
        deathDate: "",
    };

    interface PersonSelection {
        current(): NewPerson | StoredPerson;
        hasMore(): boolean;
        isEmpty(): boolean;
        replace(variants: StoredPerson[]): PersonSelection;
    }

    class EmptyPersonSelection implements PersonSelection {
        replace(variants: StoredPerson[]) {
            return this;
        }

        hasMore(): boolean {
            return false;
        }
        current(): NewPerson | StoredPerson {
            return nullPerson;
        }
        isEmpty() {
            return true;
        }
    }

    class NonEmptyPersonSelection implements PersonSelection {
        private selected: number;
        private stored: StoredPerson[];
        private newP: NewPerson;

        constructor(pd: NewPerson) {
            this.selected = 0;
            this.newP = pd;
            this.stored = [];
        }

        current(): NewPerson | StoredPerson {
            if (this.selected == 0) return this.newP;
            return this.stored[this.selected - 1];
        }

        hasMore(): boolean {
            return this.stored.length > 1;
        }

        next(): NewPerson | StoredPerson {
            if (this.selected++ >= this.stored.length) this.selected = 0;
            return this.current();
        }

        replace(variants: StoredPerson[]) {
            this.stored = variants;
            this.selected = 0;
            return this;
        }

        isEmpty() {
            return false;
        }
    }

    let selectedPeople: PersonSelection[] = [new EmptyPersonSelection()];

    function onPersonChanged(personIndex: number, name: string, birthDate: string, deathDate: string) {
        let newP = {
            name: name,
            birthDate: birthDate,
            deathDate: deathDate,
        };

        selectedPeople[personIndex] = isEqual(newP, nullPerson) ? new EmptyPersonSelection() : new NonEmptyPersonSelection(newP);
        let nonEmptySelections = selectedPeople.filter((selection) => !selection.isEmpty());

        selectedPeople = nonEmptySelections.length < maxPeopleCount ? [...nonEmptySelections, new EmptyPersonSelection()] : nonEmptySelections;

        dispatch("personChanged", { index: personIndex, descr: newP });
    }

    export function propose(personIndex: number, descr: StoredPerson[]) {
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
