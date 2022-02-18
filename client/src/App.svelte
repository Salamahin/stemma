<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar, {selectGraph} from "./components/Navbar.svelte";
    import AddGraph from './components/AddGraph.svelte'
    import {Model} from "./model.ts";
    import type {OwnedGraphs, User} from "./model.ts";

    export let google_client_id;
    export let stemma_backend_url;

    //components
    let authComponent;
    let addGraphComponent;
    let navbarComponent;

    //model
    let model: Model;
    let user: User = {
        name: "john doe",
        id_token: "",
        image_url: "",
    };
    let signedIn = false;
    let ownedGraphs: OwnedGraphs = {graphs: []};
    let selectedGraph;

    //handlers
    function handleSignIn(event: CustomEvent) {
        user = event.detail as User;
        signedIn = true;
        model = new Model(stemma_backend_url, user);
        model.listGraphs().then(graphs => {
            ownedGraphs = graphs
            if (ownedGraphs.graphs.length == 0)
                addGraphComponent.forcePromptNewGraph()
        })
    }

    function handleSignOut() {
        authComponent.signOut();
        signedIn = false;
    }

    function handleNewGraph(event: CustomEvent<string>) {
        let name = event.detail
        model.addGraph(name).then(graph => {
            ownedGraphs = {
                graphs: [...ownedGraphs.graphs, graph]
            }
            navbarComponent.selectGraph(graph);
        })
    }

    $: authenticateDisplay = !signedIn ? "d-block" : "d-none";
    $: workspaceDisplay = signedIn ? "d-block" : "d-none";
</script>

<main>
    <div class="authenticate-bg {authenticateDisplay}">
        <div class="authenticate-holder">
            <Authenticate
                    google_client_id={google_client_id}
                    bind:this={authComponent}
                    on:signIn={handleSignIn}
            />
        </div>
    </div>

    <div class={workspaceDisplay}>
        <Navbar {user} graphs={ownedGraphs}
                bind:this={navbarComponent}
                on:signOut={handleSignOut}
                on:graphSelected={graph => selectedGraph = graph}
                on:createNewGraph={() => addGraphComponent.promptNewGraph()}
        />
    </div>

    <AddGraph
            bind:this={addGraphComponent}
            on:graphAdded={handleNewGraph}
    />

    <script src="vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
</main>

<style>
    main {
        height: 100%;
    }

    .authenticate-bg {
        background-image: url("/assets/bg.webp");
        height: 100%;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
    }

    .authenticate-holder {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
    }
</style>
