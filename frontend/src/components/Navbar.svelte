<script lang="ts">
    import * as bootstrap from "bootstrap";
    import type { StemmaDescription, PersonDescription } from "../model";
    import SearchAutocomplete from "./misc/SearchAutocomplete.svelte";
    import { locale, t } from "../i18n";

    type Props = {
        ownedStemmas: StemmaDescription[];
        currentStemmaId: string;
        people?: PersonDescription[];
        disabled: boolean;
        onselectStemma?: (id: string) => void;
        oncreateNewStemma?: () => void;
        oncloneStemma?: (id: string) => void;
        onrenameStemma?: (s: StemmaDescription) => void;
        oncreateNewFamily?: () => void;
        onremoveStemma?: (s: StemmaDescription) => void;
        oninvite?: () => void;
        onabout?: () => void;
        onsettings?: () => void;
        onexport?: () => void;
        onzoomToPerson?: (id: string) => void;
    };

    let {
        ownedStemmas,
        currentStemmaId,
        people = [],
        disabled,
        onselectStemma,
        oncreateNewStemma,
        oncloneStemma,
        onrenameStemma,
        oncreateNewFamily,
        onremoveStemma,
        oninvite,
        onabout,
        onsettings,
        onexport,
        onzoomToPerson,
    }: Props = $props();

    let navbarCollapseEl = $state<HTMLElement>(null);

    function handlePersonSelect(id: string) {
        const instance = bootstrap.Collapse.getInstance(navbarCollapseEl);
        if (instance) instance.hide();
        onzoomToPerson?.(id);
    }
</script>

<header>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container-fluid">
            <div class="brand-group">
                <a class="navbar-brand" href="/" onclick={(e) => e.preventDefault()}><img src="assets/logo_bw_avg.webp" alt="" width="40" height="40" /> Stemma</a>
                <button
                    type="button"
                    class="nav-link lang-switch"
                    aria-label={$t('nav.language')}
                    onclick={() => locale.set($locale === 'en' ? 'ru' : 'en')}
                >
                    {$locale === 'en' ? 'RU' : 'EN'}
                </button>
            </div>
            <button
                class="navbar-toggler"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#navbarTogglerDemo02"
                aria-controls="navbarTogglerDemo02"
                aria-expanded="false"
                aria-label="Toggle navigation"
            >
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarTogglerDemo02" bind:this={navbarCollapseEl}>
                <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                    <li class="nav-item dropdown {disabled ? 'd-none' : ''}">
                        <a class="nav-link dropdown-toggle" href="/" onclick={(e) => e.preventDefault()} id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            {$t('nav.familyTrees')}
                        </a>
                        {#if ownedStemmas}
                            <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink">
                                {#each ownedStemmas as s}
                                    <li>
                                        <div class="stemma-row d-flex flex-row align-items-center mt-1 me-1">
                                            <a
                                                class="dropdown-item stemma-name {s.id == currentStemmaId ? 'active' : ''}  {disabled ? 'd-none' : ''}"
                                                href="/"
                                                onclick={(e) => { e.preventDefault(); onselectStemma?.(s.id); }}>{s.name}</a
                                            >
                                            <button
                                                type="button"
                                                class="btn btn-outline-secondary btn-sm ms-1 stemma-action {disabled ? 'd-none' : ''}"
                                                aria-label={$t("stemma.rename")}
                                                onclick={() => onrenameStemma?.(s)}><i class="bi bi-pencil"></i></button
                                            >
                                            {#if s.id != currentStemmaId && s.removable}
                                                <button
                                                    type="button"
                                                    class="btn btn-danger btn-sm ms-1 stemma-action {disabled ? 'd-none' : ''}"
                                                    aria-label={$t("common.delete")}
                                                    onclick={() => onremoveStemma?.(s)}><i class="bi bi-trash"></i></button
                                                >
                                            {:else if s.id == currentStemmaId}
                                                <button
                                                    type="button"
                                                    class="btn btn-primary btn-sm ms-1 stemma-action {disabled ? 'd-none' : ''}"
                                                    aria-label={$t("stemma.clone")}
                                                    onclick={() => oncloneStemma?.(s.id)}><i class="bi bi-subtract"></i></button
                                                >
                                            {:else}
                                                <button
                                                    type="button"
                                                    tabindex="-1"
                                                    aria-hidden="true"
                                                    class="btn btn-sm ms-1 stemma-action stemma-action-placeholder"
                                                ><i class="bi bi-trash"></i></button>
                                            {/if}
                                        </div>
                                    </li>
                                {/each}
                                <li>
                                    <hr class="dropdown-divider" />
                                </li>

                                <li>
                                    <a class="dropdown-item  {disabled ? 'd-none' : ''}" href="/" onclick={(e) => { e.preventDefault(); oncreateNewStemma?.(); }}>{$t('nav.createNew')}</a>
                                </li>
                            </ul>
                        {/if}
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="/" onclick={(e) => { e.preventDefault(); oncreateNewFamily?.(); }}
                            ><i class="bi bi-people-fill"></i> {$t('nav.addFamily')}</a
                        >
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="/" onclick={(e) => { e.preventDefault(); oninvite?.(); }}
                            ><i class="bi bi-share-fill"></i> {$t('nav.inviteMember')}</a
                        >
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="/" onclick={(e) => { e.preventDefault(); onsettings?.(); }}
                            ><i class="bi bi-gear-fill"></i> {$t('nav.settings')}</a
                        >
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="/" onclick={(e) => { e.preventDefault(); onexport?.(); }}
                            ><i class="bi bi-download"></i> {$t('nav.export')}</a
                        >
                    </li>
                </ul>
                <div class="d-flex ms-auto align-items-center">
                    <ul class="navbar-nav w-100 align-items-center">
                        <li class="nav-item">
                            <SearchAutocomplete
                                {people}
                                {disabled}
                                onselect={handlePersonSelect}
                            />
                        </li>
                        <li class="nav-item">
                            <a class="nav-item nav-link active" href="/" onclick={(e) => { e.preventDefault(); onabout?.(); }}>{$t('nav.about')}</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </nav>
</header>

<style>
    .brand-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
    }

    .lang-switch {
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
        background: transparent;
        border: 0;
        padding: 0.5rem 0.5rem;
        color: rgba(255, 255, 255, 0.55);
    }

    .lang-switch:hover,
    .lang-switch:focus-visible {
        color: rgba(255, 255, 255, 0.75);
        text-decoration: none;
    }

    .stemma-row .stemma-name {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .stemma-row .stemma-action {
        flex: 0 0 auto;
    }

    .stemma-action-placeholder {
        visibility: hidden;
        pointer-events: none;
    }
</style>
