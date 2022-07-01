<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import AddStemmaModal from "./components/AddStemmaModal.svelte";
    import GraphField from "./components/GraphField.svelte";
    import { Model, StemmaDescription, User } from "./model";

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
    let ownedStemmas: StemmaDescription[] = [];
    let selectedStemma;

    //handlers
    function handleSignIn(event: CustomEvent) {
        user = event.detail as User;
        signedIn = true;
        model = new Model(stemma_backend_url, user);
        model.listStemmas().then((stemmas) => {
            ownedStemmas = stemmas.stemmas;
            if (ownedStemmas.length == 0) addStemmaModal.forcePromptNewStemma();
        });
    }

    function handleSignOut() {
        authComponent.signOut();
        signedIn = false;
    }

    function handleNewStemma(event: CustomEvent<string>) {
        let name = event.detail;
        model.addStemma(name).then((stemma) => {
            ownedStemmas = [...ownedStemmas, stemma];
            navbarComponent.selectStemma(stemma);
        });
    }

    $: authenticateDisplay = !signedIn ? "d-block" : "d-none";
    $: workspaceDisplay = signedIn ? "d-block" : "d-none";
</script>

<main>
    <div class="authenticate-bg {authenticateDisplay}">
        <div class="authenticate-holder">
            <Authenticate
                {google_client_id}
                bind:this={authComponent}
                on:signIn={handleSignIn}
            />
        </div>
    </div>

    <div class={workspaceDisplay}>
        <Navbar
            {user}
            stemmas={ownedStemmas}
            bind:this={navbarComponent}
            on:signOut={handleSignOut}
            on:stemmaSelected={(stemma) => (selectedStemma = stemma)}
            on:createNewStemma={() => addStemmaModal.promptNewStemma()}
        />
    </div>

    <AddStemmaModal
        bind:this={addStemmaModal}
        on:stemmaAdded={handleNewStemma}
    />

    <GraphField />

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
