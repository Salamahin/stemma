<script>
    import { createEventDispatcher } from "svelte";
    import jwt_decode from "jwt-decode";
    import { onMount } from "svelte";

    const dispatch = createEventDispatcher();

    export let google_client_id;

    let gsiLoaded, mounted;

    onMount(() => {
        mounted = true;
    });

    function gsiLoad() {
        gsiLoaded = true;
    }

    function handleCredentialResponse(response) {
        let decoded = jwt_decode(response.credential);

        dispatch("signIn", {
            name: decoded.given_name,
            image_url: decoded.picture,
            id_token: response.credential,
        });
    }

    $: if (gsiLoaded && mounted) {
        google.accounts.id.initialize({
            client_id: google_client_id,
            callback: handleCredentialResponse,
            auto_select: true,
        });
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                google.accounts.id.renderButton(
                    document.getElementById("signin"),
                    { theme: "outline", size: "large"  }
                );
            }
        });
    }
</script>

<svelte:head>
    <script defer async src="https://accounts.google.com/gsi/client" on:load={gsiLoad}></script>
    <meta name="google-signin-client_id" content={google_client_id} />
</svelte:head>

<div class="main-container">
    <div class="d-flex justify-content-center align-items-center flex-column">
        <h1>project stemma</h1>
        <img src="assets/logo_bw_avg.webp" alt="" width="100" height="100" />
        <div class="mt-5" style="max-width:250px">
            <div id="signin"></div>
        </div>
    </div>
</div>

<style>
    h1 {
        font-size: 4em;
        font-weight: 100;
        text-align: center;
        margin: 0 0 30px 0;
        color: ghostwhite;
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
