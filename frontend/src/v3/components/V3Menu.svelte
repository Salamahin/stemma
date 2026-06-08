<script lang="ts">
    import { t } from "../../i18n";

    type Props = {
        showSignOut: boolean;
        onabout?: () => void;
        onsettings?: () => void;
        onexport?: () => void;
        onsignOut?: () => void;
    };

    let { showSignOut, onabout, onsettings, onexport, onsignOut }: Props = $props();

    let open = $state(false);

    function toggle() {
        open = !open;
    }

    function closeAndCall(fn?: () => void) {
        open = false;
        fn?.();
    }
</script>

<div class="v3-menu">
    <button
        type="button"
        class="menu-btn"
        onclick={toggle}
        aria-label="Menu"
        aria-expanded={open}
    >
        <img src="/assets/logo_color.webp" alt="Stemma" width="32" height="32" />
    </button>

    {#if open}
        <div class="menu-dropdown">
            <button type="button" class="menu-item" onclick={() => closeAndCall(onabout)} data-testid="v3-menu-about">
                <i class="bi bi-info-circle me-2"></i>{$t("v2.about")}
            </button>
            <button type="button" class="menu-item" onclick={() => closeAndCall(onsettings)} data-testid="v3-menu-settings">
                <i class="bi bi-gear me-2"></i>{$t("v2.settings")}
            </button>
            <button type="button" class="menu-item" onclick={() => closeAndCall(onexport)} data-testid="v3-menu-export">
                <i class="bi bi-download me-2"></i>{$t("v2.exportSvg")}
            </button>
            {#if showSignOut}
                <div class="menu-divider"></div>
                <button type="button" class="menu-item sign-out" onclick={() => closeAndCall(onsignOut)}>
                    <i class="bi bi-box-arrow-right me-2"></i>{$t("v2.signOut")}
                </button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .v3-menu {
        position: relative;
    }

    .menu-btn {
        display: flex;
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
        transition: box-shadow 0.15s ease, transform 0.1s ease;
        overflow: hidden;
    }

    .menu-btn img {
        display: block;
    }

    .menu-btn:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
        transform: translateY(-1px);
    }

    .menu-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        min-width: 180px;
        z-index: 1000;
        overflow: hidden;
        padding: 4px 0;
    }

    .menu-item {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 10px 16px;
        background: none;
        border: none;
        text-align: left;
        font-size: 0.875rem;
        cursor: pointer;
        color: #212529;
    }

    .menu-item:hover {
        background: #f8f9fa;
    }

    .menu-item.sign-out {
        color: #dc3545;
    }

    .menu-divider {
        height: 1px;
        background: #dee2e6;
        margin: 4px 0;
    }
</style>
