<script lang="ts">
    import { jwtDecode } from "jwt-decode";
    import { onMount } from "svelte";

    type Props = {
        google_client_id: string;
        onsignIn?: (user: { name: string; image_url: string; id_token: string }) => void;
    };

    let { google_client_id, onsignIn }: Props = $props();

    let gsiLoaded = $state(false);
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
        const ready = (window as any).__gsiReady;
        if (ready && typeof ready.then === "function") {
            ready.then(() => {
                gsiLoaded = true;
            });
        } else if ((window as any).google && (window as any).google.accounts) {
            gsiLoaded = true;
        }
    });

    function handleCredentialResponse(response: any) {
        const decoded = jwtDecode<{ given_name: string; picture: string }>(response.credential);

        onsignIn?.({
            name: decoded.given_name,
            image_url: decoded.picture,
            id_token: response.credential,
        });
    }

    $effect(() => {
        if (gsiLoaded && mounted) {
            (window as any).google.accounts.id.initialize({
                client_id: google_client_id,
                callback: handleCredentialResponse,
                auto_select: true,
            });
            (window as any).google.accounts.id.prompt((notification: any) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    (window as any).google.accounts.id.renderButton(
                        document.getElementById("signin"),
                        { theme: "outline", size: "large" }
                    );
                }
            });
        }
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
