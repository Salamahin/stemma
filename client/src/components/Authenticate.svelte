<script>
    import { createEventDispatcher } from "svelte";
    import { Circle2 } from "svelte-loading-spinners";
    import jwt_decode from "jwt-decode";

    const dispatch = createEventDispatcher();

    export let google_client_id;

    window.onload = function () {
        google.accounts.id.initialize({
            client_id: google_client_id,
            callback: handleCredentialResponse,
        });
        google.accounts.id.prompt();
    };

    function handleCredentialResponse(response) {
        console.log(response);
        let decoded = jwt_decode(response.credential);
        console.log(decoded);

        dispatch("signIn", {
            name: decoded.given_name,
            image_url: decoded.picture,
            id_token: response.credential,
        });
    }

    export function signOut() {
        let auth = gapi.auth2.getAuthInstance();
        auth.signOut();
    }
</script>

<svelte:head>
    <meta name="google-signin-client_id" content={google_client_id} />
</svelte:head>

<div class="main-container">
    <div>
        <h1>project stemma</h1>
        <div class="d-flex justify-content-center">
            <div class="d-flex w-100 justify-content-center">
                <Circle2 />
            </div>
            <div class="g_id_signin" data-type="standard" />
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
