<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { StemmaDescription } from "../model";

    export let ownedStemmas: StemmaDescription[];
    export let currentStemmaId: string;
    export let lookupPersonName;
    export let disabled: boolean;

    const dispatch = createEventDispatcher();
</script>

<header>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container-fluid">
            <a class="navbar-brand" href="#"><img src="assets/logo_bw_avg.webp" alt="" width="40" height="40" /> Stemma</a>
            <button
                class="navbar-toggler"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#navbarTogglerDemo02"
                aria-controls="navbarTogglerDemo02"
                aria-expanded="false"
                aria-label="Toggle navigation"
            >
                <span class="navbar-toggler-icon" />
            </button>
            <div class="collapse navbar-collapse" id="navbarTogglerDemo02">
                <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                    <li class="nav-item dropdown {disabled ? 'd-none' : ''}">
                        <a class="nav-link dropdown-toggle" href="#" id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Родословные
                        </a>
                        {#if ownedStemmas}
                            <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink">
                                {#each ownedStemmas as s}
                                    <li>
                                        <div class="d-flex flex-row mt-1 me-1">
                                            <a
                                                class="dropdown-item {s.id == currentStemmaId ? 'active' : ''}  {disabled ? 'd-none' : ''}"
                                                href="#"
                                                on:click={() => dispatch("selectStemma", s.id)}>{s.name}</a
                                            >
                                            {#if s.id != currentStemmaId && s.removable}
                                                <button
                                                    type="button"
                                                    class="btn btn-danger btn-sm ms-1 {disabled ? 'd-none' : ''}"
                                                    on:click={(e) => dispatch("removeStemma", s)}><i class="bi bi-trash" /></button
                                                >
                                            {:else if s.id == currentStemmaId}
                                                <button
                                                    type="button"
                                                    class="btn btn-primary btn-sm ms-1 {disabled ? 'd-none' : ''}"
                                                    on:click={(e) => dispatch("cloneStemma", s.id)}><i class="bi bi-subtract" /></button
                                                >
                                            {/if}
                                        </div>
                                    </li>
                                {/each}
                                <li>
                                    <hr class="dropdown-divider" />
                                </li>

                                <li>
                                    <a class="dropdown-item  {disabled ? 'd-none' : ''}" href="#" on:click={() => dispatch("createNewStemma")}>Создать новую</a>
                                </li>
                            </ul>
                        {/if}
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="#" on:click={() => dispatch("createNewFamily")}
                            ><i class="bi bi-people-fill" /> Добавить семью</a
                        >
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="#" on:click={() => dispatch("invite")}
                            ><i class="bi bi-share-fill" /> Пригласить участника</a
                        >
                    </li>
                </ul>
                <div class="d-flex ms-auto">
                    <ul class="navbar-nav w-100">
                        <li class="nav-item">
                            <input
                                type="search"
                                class="form-control mw-100"
                                style="min-width: 350px"
                                placeholder="Быстрый поиск"
                                bind:value={lookupPersonName}
                            />
                        </li>
                        <li class="nav-item">
                            <a class="nav-item nav-link active" href="#" on:click={() => dispatch("about")}>О проекте</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </nav>
</header>
