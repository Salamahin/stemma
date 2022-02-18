<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import AddStemmaModal from './components/AddStemmaModal.svelte'
    import {Model} from "./model.ts";
    import type {OwnedStemmas, User} from "./model.ts";

    export let google_client_id;
    export let stemma_backend_url;

    //components
    let authComponent;
    let addStemmaModal;
    let navbarComponent;

    //model
    let model: Model;
    let user: User = {
        name: "john doe",
        id_token: "",
        image_url: "",
    };
    let signedIn = false;
    let ownedStemmas: OwnedStemmas = {stemmas: []};
    let selectedStemma;

    //handlers
    function handleSignIn(event: CustomEvent) {
        user = event.detail as User;
        signedIn = true;
        model = new Model(stemma_backend_url, user);
        model.listGraphs().then(stemmas => {
            ownedStemmas = stemmas
            if (ownedStemmas.stemmas.length == 0)
                addStemmaModal.forcePromptNewStemma()
        })
    }

    function handleSignOut() {
        authComponent.signOut();
        signedIn = false;
    }

    function handleNewStemma(event: CustomEvent<string>) {
        let name = event.detail
        model.addGraph(name).then(stemma => {
            ownedStemmas = {
                stemmas: [...ownedStemmas.stemmas, stemma]
            }
            navbarComponent.selectStemma(stemma);
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
        <Navbar {user} graphs={ownedStemmas}
                bind:this={navbarComponent}
                on:signOut={handleSignOut}
                on:graphSelected={stemma => selectedStemma = stemma}
                on:createNewGraph={() => addStemmaModal.promptNewStemma()}
        />
    </div>

    <AddStemmaModal
            bind:this={addStemmaModal}
            on:stemmajrtqAdded={handleNewStemma}
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
