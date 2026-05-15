<script lang="ts">
    import type { Stemma } from "../../model";
    import { StemmaIndex } from "../../stemmaIndex";
    import { HiglightLineages } from "../../highlight";
    import { t } from "../../i18n";

    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;
    export let highlight: HiglightLineages;
    export let highlightVersion: number;

    type Stats = {
        active: boolean;
        people: number;
        families: number;
        depth: number;
    };

    function totalStats(): Stats {
        return {
            active: false,
            people: stemma.people.length,
            families: stemma.families.length,
            depth: stemma.people.length ? stemmaIndex.maxGeneration() + 1 : 0,
        };
    }

    function highlightedStats(): Stats {
        const peopleIds = highlight.highlightedPeopleIds();
        const familyIds = highlight.highlightedFamilyIds();

        let minGen = Infinity;
        let maxGen = -Infinity;
        peopleIds.forEach((id) => {
            const g = stemmaIndex.lineage(id).generation;
            if (g < minGen) minGen = g;
            if (g > maxGen) maxGen = g;
        });

        const depth = peopleIds.size ? maxGen - minGen + 1 : 0;

        return {
            active: true,
            people: peopleIds.size,
            families: familyIds.size,
            depth,
        };
    }

    $: stats =
        stemma && stemmaIndex && highlight && highlightVersion >= 0
            ? highlight.isActive()
                ? highlightedStats()
                : totalStats()
            : null;
</script>

{#if stats}
    <aside class="stats-card" class:active={stats.active} aria-live="polite">
        <div class="title">
            {stats.active ? $t("stats.highlighted") : ""}
        </div>
        <div class="row">
            <span class="label">{$t("stats.people")}</span>
            <span class="value">{stats.people}</span>
        </div>
        <div class="row">
            <span class="label">{$t("stats.families")}</span>
            <span class="value">{stats.families}</span>
        </div>
        <div class="row">
            <span class="label">{$t("stats.depth")}</span>
            <span class="value">{stats.depth}</span>
        </div>
    </aside>
{/if}

<style>
    .stats-card {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 1000;
        padding: 10px 14px;
        min-width: 140px;
        background: rgba(33, 37, 41, 0.72);
        color: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
        line-height: 1.55;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        pointer-events: none;
        transition: border-color 120ms ease, background 120ms ease;
        user-select: none;
    }

    .stats-card.active {
        border-color: rgba(255, 196, 0, 0.55);
        background: rgba(33, 37, 41, 0.82);
    }

    .title {
        min-height: 14px;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 196, 0, 0.75);
        margin-bottom: 4px;
    }

    .row {
        display: flex;
        justify-content: space-between;
        gap: 14px;
    }

    .label {
        color: rgba(255, 255, 255, 0.55);
    }

    .value {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
    }
</style>
