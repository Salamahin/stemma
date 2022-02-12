<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import type {User} from "./model.ts";
    import {Model} from "./model.ts";

    export let google_client_id;
    export let stemma_backend_url;

    let model: Model;
    let user: User = {
        name: "john doe",
        token_id: "",
        image_url: "",
    };

    let signedIn = false;
    let auth;

    function handleSignIn(event: CustomEvent) {
        user = event.detail as User;
        signedIn = true;
        model = new Model(stemma_backend_url, user);
        console.log(model.listGraphs());
    }

    function handleSignOut() {
        auth.signOut();
        signedIn = false;
    }

    $: authenticateDisplay = !signedIn ? "d-block" : "d-none";
    $: workspaceDisplay = signedIn ? "d-block" : "d-none";
</script>

<main>
    <div class="authenticate-bg {authenticateDisplay}">
        <div class="authenticate-holder">
            <Authenticate
                    google_client_id={google_client_id}
                    bind:this={auth}
                    on:signIn={handleSignIn}
            />
        </div>
    </div>

    <div class={workspaceDisplay}>
        <Navbar {user} on:signOut={handleSignOut}/>
    </div>
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