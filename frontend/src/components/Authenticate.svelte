<script lang="ts">
    import { onMount } from "svelte";
    import { initializeGoogleAuth, onCredential, renderGoogleButton } from "../googleAuth";
    import { locale, t } from "../i18n";

    type Props = {
        google_client_id: string;
        onsignIn?: (idToken: string) => void;
    };

    let { google_client_id, onsignIn }: Props = $props();
    let buttonDiv = $state<HTMLDivElement | null>(null);

    onMount(() => {
        const unsubscribe = onCredential((credential) => onsignIn?.(credential));
        initializeGoogleAuth(google_client_id)
            .then((g) => g.accounts.id.prompt())
            .catch((err) => console.error("Google Identity init failed", err));
        return unsubscribe;
    });

    $effect(() => {
        if (buttonDiv) {
            renderGoogleButton(buttonDiv, $locale)
                .catch((err) => console.error("Google Sign-In button render failed", err));
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
        <div bind:this={buttonDiv} class="mt-4 d-flex justify-content-center"></div>
        <div class="legal mt-4">
            <a href="/privacy.html">{$t("legal.privacy")}</a>
            <a href="/terms.html">{$t("legal.terms")}</a>
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

    .legal {
        display: flex;
        gap: 20px;
        font-size: 0.85rem;
    }

    .legal a {
        color: ghostwhite;
        opacity: 0.75;
        text-decoration: none;
    }

    .legal a:hover {
        opacity: 1;
        text-decoration: underline;
    }

    .main-container {
        backdrop-filter: blur(4px) brightness(40%);
        color: ghostwhite;
        border-radius: 10px;
        padding: 40px 60px;
    }
</style>
