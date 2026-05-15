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
        <table>
            <tbody>
                <tr><td class="label">{$t("stats.people")}</td><td class="value">{stats.people}</td></tr>
                <tr><td class="label">{$t("stats.families")}</td><td class="value">{stats.families}</td></tr>
                <tr><td class="label">{$t("stats.depth")}</td><td class="value">{stats.depth}</td></tr>
            </tbody>
        </table>
    </aside>
{/if}

<style>
    .stats-card {
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 1000;
        padding: 6px 9px;
        background: rgba(33, 37, 41, 0.7);
        color: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 10px;
        line-height: 1.4;
        white-space: nowrap;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        pointer-events: none;
        transition: border-color 120ms ease;
        user-select: none;
    }

    .stats-card.active {
        border-color: rgba(255, 196, 0, 0.55);
    }

    table {
        border-collapse: collapse;
    }

    td {
        padding: 0;
    }

    .label {
        color: rgba(255, 255, 255, 0.5);
        text-align: left;
        padding-right: 14px;
    }

    .value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
    }
</style>
