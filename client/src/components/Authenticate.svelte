<script>
    import { createEventDispatcher } from "svelte";
    import { Circle2 } from "svelte-loading-spinners";

    const dispatch = createEventDispatcher();

    export let google_client_id;

    window.onSignIn = () => {
        let currentUser = gapi.auth2.getAuthInstance().currentUser.get();
        let profile = currentUser.getBasicProfile();
        let token = currentUser.getAuthResponse().id_token;

        dispatch("signIn", {
            name: profile.getName(),
            image_url: profile.getImageUrl(),
            id_token: token,
        });
    };

    let authInited = false;
    window.onLoadCallback = () => {
        gapi.load("auth2", function () {
            authInited = true;
        });
    };

    export function signOut() {
        let auth = gapi.auth2.getAuthInstance();
        auth.signOut();
    }

    $: signInDisplayBlock = authInited ? "d-block" : "d-none";
    $: loadingSpinnerBlock = authInited ? "d-none" : "d-block";
</script>

<svelte:head>
    <meta name="google-signin-client_id" content={google_client_id} />
</svelte:head>

<div class="main-container">
    <div>
        <h1>project stemma</h1>
        <div
            class="g-signin2 {signInDisplayBlock}"
            data-longtitle="true"
            data-onsuccess="onSignIn"
            data-width="380"
            data-height="50"
        />
        <div class={loadingSpinnerBlock}>
            <div class="d-flex w-100 justify-content-center">
                <Circle2 />
            </div>
        </div>
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
