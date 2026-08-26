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
    <header class="d-flex justify-content-center align-items-center flex-column">
        <img src="assets/logo_bw_avg.webp" alt="" width="100" height="100" />
        <h1>project stemma</h1>
        <p class="tagline">{$t("landing.tagline")}</p>
    </header>

    <p class="intro">{$t("about.intro")}</p>

    <ul class="features">
        <li>{$t("landing.feature1")}</li>
        <li>{$t("landing.feature2")}</li>
        <li>{$t("landing.feature3")}</li>
    </ul>

    <div class="signin d-flex justify-content-center align-items-center flex-column">
        <p class="hint">{$t("landing.signInHint")}</p>
        <div bind:this={buttonDiv} class="d-flex justify-content-center"></div>
        <div class="legal mt-4">
            <a href="/privacy.html">{$t("legal.privacy")}</a>
            <a href="/terms.html">{$t("legal.terms")}</a>
        </div>
    </div>
</div>

<style>
    h1 {
        font-size: 3em;
        font-weight: 100;
        text-align: center;
        margin: 20px 0 10px 0;
        color: ghostwhite;
    }

    .tagline {
        font-size: 1.1rem;
        text-align: center;
        margin: 0;
        opacity: 0.9;
    }

    .intro {
        margin: 30px 0 0 0;
        line-height: 1.5;
        opacity: 0.85;
    }

    .features {
        margin: 16px 0 0 0;
        padding-left: 1.2em;
        line-height: 1.5;
        opacity: 0.85;
    }

    .features li + li {
        margin-top: 8px;
    }

    .signin {
        margin-top: 30px;
    }

    .hint {
        margin: 0 0 16px 0;
        text-align: center;
        opacity: 0.9;
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
        max-width: 680px;
        margin: 20px;
        overflow-y: auto;
        max-height: calc(100vh - 40px);
    }

    @media (max-width: 600px) {
        h1 {
            font-size: 2.2em;
        }

        .main-container {
            padding: 24px 20px;
            margin: 10px;
            max-height: calc(100vh - 20px);
        }
    }
</style>
