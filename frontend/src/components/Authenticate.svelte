<script lang="ts">
    import { onMount } from "svelte";
    import { initializeGoogleAuth, onCredential, promptInitialSignIn } from "../googleAuth";

    type Props = {
        google_client_id: string;
        onsignIn?: (idToken: string) => void;
    };

    let { google_client_id, onsignIn }: Props = $props();

    onMount(() => {
        const unsubscribe = onCredential((credential) => onsignIn?.(credential));
        initializeGoogleAuth(google_client_id)
            .then(() => promptInitialSignIn(document.getElementById("signin")))
            .catch((err) => console.error("Google Identity init failed", err));
        return unsubscribe;
    });
</script>

<svelte:head>
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
