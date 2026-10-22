<script lang="ts">
    import type { Stemma } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { HighlightLineages } from "../highlight";
    import { t } from "../i18n";
    import { personColor } from "../graphStyles";

    /** The node colours from the oldest to the youngest, as a CSS gradient. */
    const AGE_GRADIENT = `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map((r) => personColor(r)).join(", ")})`;

    type Props = {
        stemma: Stemma;
        stemmaIndex: StemmaIndex;
        highlight: HighlightLineages;
        highlightVersion: number;
    };

    let { stemma, stemmaIndex, highlight, highlightVersion }: Props = $props();

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

    const years = $derived(stemmaIndex?.birthYearRange() ?? null);

    const stats = $derived(
        stemma && stemmaIndex && highlight && highlightVersion >= 0
            ? highlight.isActive()
                ? highlightedStats()
                : totalStats()
            : null
    );
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
        {#if years}
            <div class="age-legend" data-testid="age-legend" title={$t("stats.ageLegend")}>
                <div class="age-bar" style:background={AGE_GRADIENT}></div>
                <div class="age-years"><span>{years[0]}</span><span>{years[1]}</span></div>
            </div>
        {/if}
    </aside>
{/if}

<style>
    .stats-card {
        position: fixed;
        right: calc(12px + env(safe-area-inset-right, 0px));
        bottom: calc(12px + env(safe-area-inset-bottom, 0px));
        z-index: 1100;
        box-sizing: border-box;
        width: 120px;
        padding: 6px 9px;
        background: rgba(33, 37, 41, 0.78);
        color: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 11px;
        line-height: 1.4;
        white-space: nowrap;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        pointer-events: none;
        transition: background-color 140ms ease;
        user-select: none;
    }

    .stats-card.active {
        background: rgba(74, 58, 22, 0.82);
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    td {
        padding: 0;
    }

    .label {
        color: rgba(255, 255, 255, 0.55);
        text-align: left;
    }

    .age-legend {
        margin-top: 5px;
    }

    .age-bar {
        height: 6px;
        border-radius: 3px;
    }

    .age-years {
        display: flex;
        justify-content: space-between;
        color: rgba(255, 255, 255, 0.55);
        font-variant-numeric: tabular-nums;
    }

    .value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
    }
</style>
