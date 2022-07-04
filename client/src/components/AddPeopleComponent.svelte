<script lang="ts">
    export let maxPeopleCount: number;
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
            <tr>
                <td
                    ><input
                        type="text"
                        class="form-control"
                        placeholder="Иванов Виталий Валерьевич"
                    /></td
                >
                <td><input class="form-control" type="date" /></td>
                <td><input class="form-control" type="date" /></td>
            </tr>
            <tr>
                <td
                    ><input
                        type="text"
                        class="form-control"
                        placeholder="Иванова Василиса Павловна"
                    /></td
                >
                <td><input class="form-control" type="date" /></td>
                <td><input class="form-control" type="date" /></td>
                <td
                    ><div
                        class="btn-group"
                        role="group"
                        aria-label="Basic example"
                    >
                        <button type="button" class="btn btn-primary"
                            >&#60 Предыдушее</button
                        >
                        <button type="button" class="btn btn-primary"
                            >Следущее &#62</button
                        >
                    </div></td
                >
            </tr>
        </tbody>
    </table>
</div>
