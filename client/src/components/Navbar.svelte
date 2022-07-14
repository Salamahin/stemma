<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { Stemma, StemmaDescription, User } from "../model";
    import Select from "svelte-select";

    export let user: User;
    export let ownedStemmasDescriptions: StemmaDescription[];
    export let selectedStemmaDescription: StemmaDescription;

    const dispatch = createEventDispatcher();

    export let stemma: Stemma;
    type FilterItem = {
        value: string;
        label: string;
    };
    let filterItems: FilterItem[] = [];

    $: if (!selectedStemmaDescription && ownedStemmasDescriptions.length) selectedStemmaDescription = ownedStemmasDescriptions[0];
    $: if (stemma) filterItems = stemma.people.map((p) => ({ value: `[${p.id}] ${p.name}`, label: p.name }));
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
                    <li class="nav-item">
                        <a class="nav-link" href="#">О проекте</a>
                    </li>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle" href="#" id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            {selectedStemmaDescription ? selectedStemmaDescription.name : "Родословные"}
                        </a>
                        <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink">
                            {#each ownedStemmasDescriptions as s}
                                <li>
                                    <a class="dropdown-item" href="#" on:click={() => (selectedStemmaDescription = s)}>{s.name}</a>
                                </li>
                            {/each}
                            <li>
                                <hr class="dropdown-divider" />
                            </li>

                            <li>
                                <a class="dropdown-item" href="#" on:click={() => dispatch("createNewStemma")}>Новая родословная...</a>
                            </li>
                        </ul>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link active" href="#" on:click={() => dispatch("createNewFamily")}>Создать</a>
                    </li>
                </ul>
                <div class="d-flex ms-auto">
                    <Select containerStyles="width: 476px" placeholder="Поиск" isMulti={true} isSearchable={true} items={filterItems} listAutoWidth={false} />
                </div>
            </div>
        </div>
    </nav>
</header>

<style>
    .avatar {
        max-width: 40px;
        max-height: 40px;
        border-radius: 50%;
    }
</style>
