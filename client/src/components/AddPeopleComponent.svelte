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
                <td>
                    <button type="button" class="btn btn-outline-primary">Следующее &raquo;</button>
                </td>
            </tr>
        </tbody>
    </table>
</div>
