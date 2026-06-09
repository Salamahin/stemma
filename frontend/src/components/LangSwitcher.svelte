<script lang="ts">
    import { locale, t } from "../i18n";
</script>

<button
    type="button"
    class="lang-switcher"
    aria-label={$t("nav.language")}
    onclick={() => locale.set($locale === "en" ? "ru" : "en")}
    data-testid="lang-switcher"
>
    {$locale === "en" ? "RU" : "EN"}
</button>

<style>
    .lang-switcher {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #fff;
        border: none;
        padding: 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        cursor: pointer;
        color: #495057;
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        transition: box-shadow 0.15s ease, transform 0.1s ease, color 0.12s ease;
    }

    .lang-switcher:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
        transform: translateY(-1px);
        color: #212529;
    }
</style>
