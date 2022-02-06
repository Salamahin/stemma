<script>
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let google_client_id;
    export function signOut() {
        let auth2 = gapi.auth2.getAuthInstance();
        auth2.signOut().then(() => dispatch("signOut"));
    }

    window.onSignIn = (googleUser) => {
        var profile = googleUser.getBasicProfile();
        dispatch("signIn", {
            name: profile.getName(),
            image_url: profile.getImageUrl(),
            id_token: googleUser.getAuthResponse().id_token
        });
    };
</script>

<svelte:head>
    <script src="https://apis.google.com/js/platform.js" async defer></script>
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
    /* h1 {
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
    } */
</style>
