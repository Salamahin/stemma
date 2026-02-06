<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import * as bootstrap from "bootstrap";
    import { StemmaDescription, PersonDescription } from "../model";
    import SearchAutocomplete from "./misc/SearchAutocomplete.svelte";
    import { locale, t } from "../i18n";

    export let ownedStemmas: StemmaDescription[];
    export let currentStemmaId: string;
    export let people: PersonDescription[] = [];
    export let disabled: boolean;

    let navbarCollapseEl: HTMLElement;

    const dispatch = createEventDispatcher();

    function handlePersonSelect(e: CustomEvent) {
        const instance = bootstrap.Collapse.getInstance(navbarCollapseEl);
        if (instance) instance.hide();
        dispatch("zoomToPerson", e.detail);
    }
</script>

<header>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container-fluid">
            <a class="navbar-brand" href="#"><img src="assets/logo_bw_avg.webp" alt="" width="40" height="40" /> Stemma</a>
            <button
                class="navbar-toggler"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#navbarTogglerDemo02"
                aria-controls="navbarTogglerDemo02"
                aria-expanded="false"
                aria-label="Toggle navigation"
            >
                <span class="navbar-toggler-icon" />
            </button>
            <div class="collapse navbar-collapse" id="navbarTogglerDemo02" bind:this={navbarCollapseEl}>
                <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                    <li class="nav-item dropdown {disabled ? 'd-none' : ''}">
                        <a class="nav-link dropdown-toggle" href="#" id="navbarDropdownMenuLink" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            {$t('nav.familyTrees')}
                        </a>
                        {#if ownedStemmas}
                            <ul class="dropdown-menu" aria-labelledby="navbarDropdownMenuLink">
                                {#each ownedStemmas as s}
                                    <li>
                                        <div class="d-flex flex-row mt-1 me-1">
                                            <a
                                                class="dropdown-item {s.id == currentStemmaId ? 'active' : ''}  {disabled ? 'd-none' : ''}"
                                                href="#"
                                                on:click={() => dispatch("selectStemma", s.id)}>{s.name}</a
                                            >
                                            {#if s.id != currentStemmaId && s.removable}
                                                <button
                                                    type="button"
                                                    class="btn btn-danger btn-sm ms-1 {disabled ? 'd-none' : ''}"
                                                    on:click={(e) => dispatch("removeStemma", s)}><i class="bi bi-trash" /></button
                                                >
                                            {:else if s.id == currentStemmaId}
                                                <button
                                                    type="button"
                                                    class="btn btn-primary btn-sm ms-1 {disabled ? 'd-none' : ''}"
                                                    on:click={(e) => dispatch("cloneStemma", s.id)}><i class="bi bi-subtract" /></button
                                                >
                                            {/if}
                                        </div>
                                    </li>
                                {/each}
                                <li>
                                    <hr class="dropdown-divider" />
                                </li>

                                <li>
                                    <a class="dropdown-item  {disabled ? 'd-none' : ''}" href="#" on:click={() => dispatch("createNewStemma")}>{$t('nav.createNew')}</a>
                                </li>
                            </ul>
                        {/if}
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="#" on:click={() => dispatch("createNewFamily")}
                            ><i class="bi bi-people-fill" /> {$t('nav.addFamily')}</a
                        >
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="#" on:click={() => dispatch("invite")}
                            ><i class="bi bi-share-fill" /> {$t('nav.inviteMember')}</a
                        >
                    </li>
                    <li class="nav-item">
                        <a class="nav-link {disabled ? 'd-none' : ''}" href="#" on:click={() => dispatch("settings")}
                            ><i class="bi bi-gear-fill" /> {$t('nav.settings')}</a
                        >
                    </li>
                </ul>
                <div class="d-flex ms-auto align-items-center">
                    <ul class="navbar-nav w-100 align-items-center">
                        <li class="nav-item">
                            <SearchAutocomplete
                                {people}
                                {disabled}
                                on:select={handlePersonSelect}
                            />
                        </li>
                        <li class="nav-item">
                            <button
                                type="button"
                                class="lang-switch"
                                aria-label={$t('nav.language')}
                                on:click={() => locale.set($locale === 'en' ? 'ru' : 'en')}
                            >
                                {$locale === 'en' ? 'RU' : 'EN'}
                            </button>
                        </li>
                        <li class="nav-item">
                            <a class="nav-item nav-link active" href="#" on:click={() => dispatch("about")}>{$t('nav.about')}</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </nav>
</header>

<style>
    .lang-switch {
        display: inline-flex;
        align-items: center;
        margin-right: 10px;
        font-size: 0.7rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        background: transparent;
        border: 0;
        padding: 2px 4px;
        color: rgba(255, 255, 255, 0.65);
    }

    .lang-switch:hover,
    .lang-switch:focus-visible {
        color: #fff;
        text-decoration: underline;
        text-underline-offset: 4px;
    }
</style>
