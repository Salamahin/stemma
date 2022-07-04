<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { onMount } from "svelte";

    const dispatch = createEventDispatcher();

    let modalEl;

    export function promptNewFamily() {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div
    class="modal fade"
    id="addFamilyModal"
    data-bs-backdrop="static"
    data-bs-keyboard="false"
    tabindex="-1"
    aria-labelledby="addFamlilyLabel"
    aria-hidden="true"
    bind:this={modalEl}
>
    <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addFamlilyLabel">Добавить семью</h5>
                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                />
            </div>
            <div class="modal-body">
                <p class="fs-5 text-center">Родители</p>

                <table class="table">
                    <thead>
                        <tr>
                            <th scope="col">Имя</th>
                            <th scope="col">Дата рождения</th>
                            <th scope="col">Дата смерти</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><input
                                type="text"
                                class="form-control"
                                placeholder="Иванов Виталий Валерьевич"
                                aria-label="Имя первого родителя"
                            /></td>
                            <td><input
                                class="form-control"
                                type="date"
                            /></td>
                            <td><input
                                class="form-control"
                                type="date"
                            /></td>
                        </tr>
                        <tr>
                            <td><input
                                type="text"
                                class="form-control"
                                placeholder="Иванов Виталий Валерьевич"
                                aria-label="Имя первого родителя"
                            /></td>
                            <td><input
                                class="form-control"
                                type="date"
                            /></td>
                            <td><input
                                class="form-control"
                                type="date"
                            /></td>
                        </tr>
                    </tbody>
                </table>

                <p class="fs-5 mt-4 mb-2 text-center">Дети</p>
                <table class="table">
                    <thead>
                        <tr>
                            <th scope="col">Имя</th>
                            <th scope="col">Дата рождения</th>
                            <th scope="col">Дата смерти</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Голощапов Сергей Георгиевич</td>
                            <td>29.08.1961</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Голощапова Евгения Анатольевна</td>
                            <td>08.09.1963</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="modal-footer">
                <button
                    type="button"
                    class="btn btn-secondary"
                    data-bs-dismiss="modal">Отмена</button
                >
                <button
                    type="button"
                    class="btn btn-primary"
                    on:click={() => promptNewFamily()}>Добавить</button
                >
            </div>
        </div>
    </div>
</div>

<style>
    body .modal-dialog {
        max-width: 100%;
        width: auto !important;
        display: inline-block;
    }
</style>
