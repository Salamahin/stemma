<script lang="ts">
    import type { AgeSteps } from "../ageSteps";
    import { personColor } from "../graphStyles";
    import { t } from "../i18n";

    /**
     * The age steps the chart is coloured by, as one thin continuous bar with the
     * labels above it. Hovering a segment shows its people as well; clicks pick
     * any number of segments to keep shown. Pinned and hovered people still win.
     */
    type Props = {
        steps: AgeSteps;
        selected: ReadonlySet<number>;
        onhover: (step: number | null) => void;
        ontoggle: (step: number) => void;
    };

    let { steps, selected, onhover, ontoggle }: Props = $props();
</script>

<div class="age-strip" role="group" aria-label={$t("ageStrip.label")} data-testid="age-strip">
    {#each steps.labels as label, i}
        <button
            type="button"
            class="age-step"
            class:selected={selected.has(i)}
            class:dimmed={selected.size > 0 && !selected.has(i)}
            style:--step-color={personColor(i, steps.count)}
            aria-pressed={selected.has(i)}
            data-testid="age-step"
            onpointerenter={(e) => e.pointerType === "mouse" && onhover(i)}
            onpointerleave={(e) => e.pointerType === "mouse" && onhover(null)}
            onfocus={() => onhover(i)}
            onblur={() => onhover(null)}
            onclick={() => ontoggle(i)}
        >
            <span class="age-label">{label}</span>
            <span class="age-bar"></span>
        </button>
    {/each}
</div>

<style>
    .age-strip {
        display: flex;
        width: min(420px, calc(100vw - 32px));
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
    }

    .age-step {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 3px;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
    }

    .age-label {
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: 0.03em;
        font-variant-numeric: tabular-nums;
        color: #495057;
        text-align: center;
        text-shadow: 0 0 3px rgba(255, 255, 255, 0.9);
        transition: color 120ms ease, opacity 120ms ease;
    }

    .age-bar {
        display: block;
        height: 7px;
        background: var(--step-color);
        transition: opacity 120ms ease, transform 120ms ease;
    }

    /* One continuous bar: only its ends are rounded, a hairline between segments. */
    .age-step:first-child .age-bar {
        border-radius: 4px 0 0 4px;
    }

    .age-step:last-child .age-bar {
        border-radius: 0 4px 4px 0;
    }

    .age-step:only-child .age-bar {
        border-radius: 4px;
    }

    .age-step + .age-step .age-bar {
        box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.55);
    }

    .age-step:hover .age-bar,
    .age-step:focus-visible .age-bar {
        transform: scaleY(1.4);
    }

    .age-step:hover .age-label,
    .age-step.selected .age-label {
        color: #212529;
    }

    .age-step:focus-visible {
        outline: none;
    }

    .age-step:focus-visible .age-label {
        text-decoration: underline;
    }

    .age-step.dimmed .age-bar {
        opacity: 0.3;
    }

    .age-step.dimmed .age-label {
        opacity: 0.55;
    }
</style>
