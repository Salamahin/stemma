<script>
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    function dispatchSignIn(token) {
        dispatch("signIn", token);
    }

    export let google_client_id;
    export function onSignOut() {
        let auth2 = gapi.auth2.getAuthInstance();
        auth2.signOut().then(() => dispatch("signOut"));
    }

    window.onLoadCallback = () => {
        let auth = gapi.auth2.getAuthInstance();
        if (auth.isSignedIn.get()) {
            dispatchSignIn(auth.id_token);
        }
    };

    window.onSignIn = (googleUser) => {
        let profile = googleUser.getBasicProfile();
        dispatchSignIn(googleUser.getAuthResponse().id_token);
    };
</script>

<svelte:head>
    <script
        src="https://apis.google.com/js/platform.js?onload=onLoadCallback"
        async
        defer></script>

    <meta name="google-signin-client_id" content={google_client_id} />
</svelte:head>

<div class="main-container">
    <div>
        <h1>project stemma</h1>
        <div
            class="g-signin2"
            id="siging"
            data-longtitle="true"
            data-onsuccess="onSignIn"
            data-width="380"
            data-height="50"
        />
    </div>
</div>

<style>
    h1 {
        font-size: 4em;
        font-weight: 100;
        text-align: center;
        margin: 0 0 30px 0;
    }
    .main-container {
        backdrop-filter: blur(4px) brightness(40%);
        color: ghostwhite;
        border-radius: 10px;
        padding: 40px 60px;
    }

    :global(.abcRioButton) {
        margin: auto;
    }
</style>
