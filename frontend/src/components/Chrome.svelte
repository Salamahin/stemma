<script lang="ts">
    import type { Stemma, StemmaDescription } from "../model";
    import type { StemmaIndex } from "../stemmaIndex";
    import type { HighlightLineages } from "../highlight";
    import Chip from "./Chip.svelte";
    import LangSwitcher from "./LangSwitcher.svelte";
    import Menu from "./Menu.svelte";
    import Fab from "./Fab.svelte";
    import Search from "./Search.svelte";
    import StatsCard from "./StatsCard.svelte";
    import AgeStrip from "./AgeStrip.svelte";

    type Props = {
        ownedStemmas: StemmaDescription[];
        currentStemmaId: string | null;
        favouriteStemmaId: string | null;
        isWorking: boolean;
        stemma: Stemma | null;
        stemmaIndex: StemmaIndex | null;
        highlight: HighlightLineages | null;
        highlightVersion: number;
        editMode: boolean;
        linkMode: boolean;
        /** The age steps kept shown by clicks on the age strip. */
        ageSelected: ReadonlySet<number>;
        onageHover: (step: number | null) => void;
        onageToggle: (step: number) => void;
        showSignOut: boolean;
        onstemmaSelect: (id: string) => void;
        onstemmaAddNew: () => void;
        onstemmaRename: (s: StemmaDescription) => void;
        onstemmaClone: (s: StemmaDescription) => void;
        onstemmaRemove: (s: StemmaDescription) => void;
        onstemmaFavourite: (s: StemmaDescription) => void;
        onsearchSelect: (id: string) => void;
        onabout: () => void;
        onsettings: () => void;
        onexport: () => void;
        onexportPng: () => void;
        onsignOut: () => void;
        oneditToggle: () => void;
        onlinkToggle: () => void;
        onaddPerson: () => void;
    };

    let {
        ownedStemmas,
        currentStemmaId,
        favouriteStemmaId,
        isWorking,
        stemma,
        stemmaIndex,
        highlight,
        highlightVersion,
        editMode,
        linkMode,
        ageSelected,
        onageHover,
        onageToggle,
        showSignOut,
        onstemmaSelect,
        onstemmaAddNew,
        onstemmaRename,
        onstemmaClone,
        onstemmaRemove,
        onstemmaFavourite,
        onsearchSelect,
        onabout,
        onsettings,
        onexport,
        onexportPng,
        onsignOut,
        oneditToggle,
        onlinkToggle,
        onaddPerson,
    }: Props = $props();

    const showAgeStrip = $derived(!isWorking && !editMode && !!stemmaIndex?.ageSteps());
</script>

<div class="chrome" class:with-age-strip={showAgeStrip} aria-hidden="false">
    <div class="top-left">
        <Chip
            {ownedStemmas}
            {currentStemmaId}
            {favouriteStemmaId}
            disabled={isWorking}
            {onstemmaSelect}
            {onstemmaAddNew}
            {onstemmaRename}
            {onstemmaClone}
            {onstemmaRemove}
            {onstemmaFavourite}
        />
    </div>

    <div class="top-center">
        {#if stemma && stemma.people.length > 0}
            <Search
                people={stemma.people}
                disabled={isWorking}
                onselect={onsearchSelect}
            />
        {/if}
    </div>

    <div class="top-right">
        <LangSwitcher />
        <Menu
            {showSignOut}
            {onabout}
            {onsettings}
            {onexport}
            {onexportPng}
            {onsignOut}
        />
    </div>

    <div class="bottom-right">
        <Fab
            {editMode}
            {linkMode}
            disabled={isWorking}
            {oneditToggle}
            {onlinkToggle}
            {onaddPerson}
        />
    </div>

    {#if showAgeStrip && stemmaIndex?.ageSteps()}
        <div class="bottom-center">
            <AgeStrip steps={stemmaIndex.ageSteps()!} selected={ageSelected} onhover={onageHover} ontoggle={onageToggle} />
        </div>
    {/if}

    {#if !isWorking && stemma && stemmaIndex && highlight}
        <div class="bottom-left">
            <StatsCard {stemma} {stemmaIndex} {highlight} {highlightVersion} />
        </div>
    {/if}
</div>

<style>
    .chrome {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .top-left {
        position: absolute;
        top: 16px;
        left: 16px;
        pointer-events: auto;
        z-index: 110;
    }

    .top-center {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        pointer-events: auto;
        z-index: 100;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    @media (max-width: 767.98px) {
        .top-center {
            top: 72px;
        }
    }

    .top-right {
        position: absolute;
        top: 16px;
        right: 16px;
        pointer-events: auto;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .bottom-right {
        position: absolute;
        bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        right: calc(20px + env(safe-area-inset-right, 0px));
        pointer-events: auto;
        z-index: 100;
    }

    .bottom-center {
        position: absolute;
        bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        left: 50%;
        transform: translateX(-50%);
        pointer-events: auto;
        z-index: 100;
    }

    /* Phones: the strip runs along the very bottom, the stats card and the edit button sit above it. */
    @media (max-width: 767.98px) {
        .bottom-center {
            bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        }

        .with-age-strip .bottom-left {
            bottom: calc(46px + env(safe-area-inset-bottom, 0px));
        }

        .with-age-strip .bottom-right {
            bottom: calc(46px + env(safe-area-inset-bottom, 0px));
        }
    }

    .bottom-left {
        position: absolute;
        bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        left: calc(16px + env(safe-area-inset-left, 0px));
        pointer-events: auto;
        z-index: 100;
    }

    :global(.bottom-left .stats-card) {
        position: static;
        bottom: auto;
        right: auto;
    }
</style>
