<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { StemmaDescription } from "../model";

    export let ownedStemmasDescriptions: StemmaDescription[];
    export let selectedStemmaDescription: StemmaDescription;

    const dispatch = createEventDispatcher();

    $: if (!selectedStemmaDescription && ownedStemmasDescriptions && ownedStemmasDescriptions.length) selectedStemmaDescription = ownedStemmasDescriptions[0];
</script>

<header>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container-fluid">
            <a class="navbar-brand" href="#">Stemma</a>
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
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Родословные
                        </a>
                        {#if ownedStemmasDescriptions}
                            <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink">
                                {#each ownedStemmasDescriptions as s}
                                    <li>
                                        <a
                                            class="dropdown-item {s == selectedStemmaDescription ? 'active' : ''}"
                                            href="#"
                                            on:click={() => (selectedStemmaDescription = s)}>{s.name}</a
                                        >
                                    </li>
                                {/each}
                                <li>
                                    <hr class="dropdown-divider" />
                                </li>

                                <li>
                                    <a class="dropdown-item" href="#" on:click={() => dispatch("createNewStemma")}>Создать новую</a>
                                </li>
                            </ul>
                        {/if}
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#" on:click={() => dispatch("createNewFamily")}><i class="bi bi-people-fill" /> Добавить семью</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#">Поиск</a>
                    </li>
                </ul>
                <hr class="border border-white" />
                <div class="d-flex ms-auto">
                    <hr class="border border-light" />
                    <ul class="navbar-nav">
                        <li class="nav-item">
                            <a class="nav-link" href="#"><i class="bi bi-share-fill" /> Поделиться</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-item nav-link active" href="#">О проекте</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </nav>
</header>
