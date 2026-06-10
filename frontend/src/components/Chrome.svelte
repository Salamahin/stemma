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

    type Props = {
        ownedStemmas: StemmaDescription[];
        currentStemmaId: string | null;
        isWorking: boolean;
        stemma: Stemma | null;
        stemmaIndex: StemmaIndex | null;
        highlight: HighlightLineages | null;
        highlightVersion: number;
        editMode: boolean;
        panMode: boolean;
        showSignOut: boolean;
        onstemmaSelect: (id: string) => void;
        onstemmaAddNew: () => void;
        onstemmaRename: (s: StemmaDescription) => void;
        onstemmaClone: (s: StemmaDescription) => void;
        onstemmaRemove: (s: StemmaDescription) => void;
        onsearchSelect: (id: string) => void;
        onabout: () => void;
        onsettings: () => void;
        onexport: () => void;
        onsignOut: () => void;
        oneditToggle: () => void;
        onpanToggle: () => void;
        onaddPerson: () => void;
    };

    let {
        ownedStemmas,
        currentStemmaId,
        isWorking,
        stemma,
        stemmaIndex,
        highlight,
        highlightVersion,
        editMode,
        panMode,
        showSignOut,
        onstemmaSelect,
        onstemmaAddNew,
        onstemmaRename,
        onstemmaClone,
        onstemmaRemove,
        onsearchSelect,
        onabout,
        onsettings,
        onexport,
        onsignOut,
        oneditToggle,
        onpanToggle,
        onaddPerson,
    }: Props = $props();
</script>

<div class="chrome" aria-hidden="false">
    <div class="top-left">
        <Chip
            {ownedStemmas}
            {currentStemmaId}
            disabled={isWorking}
            {onstemmaSelect}
            {onstemmaAddNew}
            {onstemmaRename}
            {onstemmaClone}
            {onstemmaRemove}
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
            {onsignOut}
        />
    </div>

    <div class="bottom-right">
        <Fab
            {editMode}
            {panMode}
            disabled={isWorking}
            {oneditToggle}
            {onpanToggle}
            {onaddPerson}
        />
    </div>

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
