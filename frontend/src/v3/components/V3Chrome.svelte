<script lang="ts">
    import type { PersonDescription, Stemma, StemmaDescription } from "../../model";
    import type { StemmaIndex } from "../../stemmaIndex";
    import type { HiglightLineages } from "../../highlight";
    import V3Chip from "./V3Chip.svelte";
    import V3LangSwitcher from "./V3LangSwitcher.svelte";
    import V3Menu from "./V3Menu.svelte";
    import V3Fab from "./V3Fab.svelte";
    import V3Search from "./V3Search.svelte";
    import V3BulkAddTray from "./V3BulkAddTray.svelte";
    import StatsCard from "../../components/stats_card/StatsCard.svelte";

    type Props = {
        ownedStemmas: StemmaDescription[];
        currentStemmaId: string | null;
        isWorking: boolean;
        stemma: Stemma | null;
        stemmaIndex: StemmaIndex | null;
        highlight: HiglightLineages | null;
        highlightVersion: number;
        editMode: boolean;
        panMode: boolean;
        showSignOut: boolean;
        orphanPeople: PersonDescription[];
        trayOpen: boolean;
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
        onbulkAdd: (names: string[]) => Promise<void> | void;
        ontrayToggle: () => void;
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
        orphanPeople,
        trayOpen,
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
        onbulkAdd,
        ontrayToggle,
    }: Props = $props();
</script>

<div class="v3-chrome" aria-hidden="false">
    <div class="v3-top-left">
        <V3Chip
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

    <div class="v3-top-center">
        {#if stemma && stemma.people.length > 0}
            <V3Search
                people={stemma.people}
                disabled={isWorking}
                onselect={onsearchSelect}
            />
        {/if}
    </div>

    <div class="v3-top-right">
        <V3LangSwitcher />
        <V3Menu
            {showSignOut}
            {onabout}
            {onsettings}
            {onexport}
            {onsignOut}
        />
    </div>

    <div class="v3-bottom-right">
        <V3Fab
            {editMode}
            {panMode}
            disabled={isWorking}
            {oneditToggle}
            {onpanToggle}
            {onaddPerson}
        />
    </div>

    {#if !isWorking && stemma && stemmaIndex && highlight}
        <div class="v3-bottom-left">
            <StatsCard {stemma} {stemmaIndex} {highlight} {highlightVersion} />
        </div>
    {/if}

    {#if editMode && stemma}
        <V3BulkAddTray
            orphans={orphanPeople}
            busy={isWorking}
            open={trayOpen}
            {onbulkAdd}
            ontoggle={ontrayToggle}
        />
    {/if}
</div>

<style>
    .v3-chrome {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .v3-top-left {
        position: absolute;
        top: 16px;
        left: 16px;
        pointer-events: auto;
        z-index: 110;
    }

    .v3-top-center {
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
        .v3-top-center {
            top: 72px;
        }
    }

    .v3-top-right {
        position: absolute;
        top: 16px;
        right: 16px;
        pointer-events: auto;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .v3-bottom-right {
        position: absolute;
        bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        right: calc(20px + env(safe-area-inset-right, 0px));
        pointer-events: auto;
        z-index: 100;
    }

    .v3-bottom-left {
        position: absolute;
        bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        left: calc(16px + env(safe-area-inset-left, 0px));
        pointer-events: auto;
        z-index: 100;
    }

    :global(.v3-bottom-left .stats-card) {
        position: static;
        bottom: auto;
        right: auto;
    }
</style>
