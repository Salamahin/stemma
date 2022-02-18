<script lang="ts">
    import {createEventDispatcher} from "svelte";
    import type {OwnedGraphs, Graph, User} from "../model.ts";

    export let user: User;
    export let graphs: OwnedGraphs;
    let selectedGraph: Graph;

    const dispatch = createEventDispatcher();

    function handleGraphSelection(g: Graph) {
        selectedGraph = g;
        dispatch("graphSelected", g)
    }

    export function selectGraph(g: Graph) {
        selectedGraph = g
    }

    $: if (!selectedGraph) selectedGraph = graphs.graphs[0];
</script>

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
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarTogglerDemo02">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                <li class="nav-item">
                    <a class="nav-link active" aria-current="page" href="#"
                    >Home</a
                    >
                </li>
                <li class="nav-item dropdown">
                    <a
                            class="nav-link dropdown-toggle"
                            href="#"
                            id="navbarDropdownMenuLink"
                            role="button"
                            data-bs-toggle="dropdown"
                            aria-expanded="false"
                    >
                        {selectedGraph ? selectedGraph.name : "Graphs"}
                    </a>
                    <ul
                            class="dropdown-menu"
                            aria-labelledby="navbarDropdownMenuLink"
                    >
                        {#each graphs.graphs as g}
                            <li><a class="dropdown-item" href="#"
                                   on:click={() => handleGraphSelection(g)}>{g.name}</a></li>
                        {/each}
                        <li>
                            <hr class="dropdown-divider"/>
                        </li>

                        <li>
                            <a class="dropdown-item" href="#" on:click={() => dispatch("createNewGraph")}>Создать...</a>
                        </li>
                    </ul>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#">О проекте</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#">Помощь</a>
                </li>
            </ul>
            <div class="navbar-nav ml-auto">
                <div class="nav-item d-flex">
                    <img src={user.image_url} class="avatar" alt="Avatar"/>
                    <a
                            class="nav-link text-secondary ms-2"
                            on:click={() => dispatch("signOut")}
                            href="#">Выйти</a
                    >
                </div>
            </div>
        </div>
    </div>
</nav>

<style>
    .avatar {
        max-width: 40px;
        max-height: 40px;
        border-radius: 50%;
    }
</style>
