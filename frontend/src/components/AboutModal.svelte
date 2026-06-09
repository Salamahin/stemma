<script lang="ts">
    import * as d3 from "d3";
    import { t } from "../i18n";
    import {
        personR, familyR, defaultFamilyColor, relationsColor,
        childRelationWidth, familyRelationWidth, labelFontSize,
        personColor, addArrowMarkers
    } from "../graphStyles";
    import Modal from "./Modal.svelte";

    let open = $state(false);
    let diagramEl = $state<HTMLDivElement | null>(null);

    const width = 360;
    const height = 220;

    function renderDiagram(translate: (key: string) => string) {
        if (!diagramEl) return;
        diagramEl.innerHTML = "";

        const svg = d3
            .select(diagramEl)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("width", "100%")
            .attr("height", "100%");

        const markers = addArrowMarkers(svg);

        const parentsY = 40;
        const familyY = 110;
        const childY = 185;
        const parentLeftX = 90;
        const parentRightX = 270;
        const familyX = 180;
        const childX = 180;

        svg.append("line").attr("x1", parentLeftX).attr("y1", parentsY)
            .attr("x2", familyX).attr("y2", familyY)
            .attr("stroke", relationsColor)
            .attr("stroke-width", familyRelationWidth)
            .attr("marker-end", markers.family);
        svg.append("line").attr("x1", parentRightX).attr("y1", parentsY)
            .attr("x2", familyX).attr("y2", familyY)
            .attr("stroke", relationsColor)
            .attr("stroke-width", familyRelationWidth)
            .attr("marker-end", markers.family);
        svg.append("line").attr("x1", familyX).attr("y1", familyY)
            .attr("x2", childX).attr("y2", childY)
            .attr("stroke", relationsColor)
            .attr("stroke-width", childRelationWidth)
            .attr("marker-end", markers.person);

        svg.append("circle").attr("cx", parentLeftX).attr("cy", parentsY).attr("r", personR).attr("fill", personColor(0));
        svg.append("circle").attr("cx", parentRightX).attr("cy", parentsY).attr("r", personR).attr("fill", personColor(0));
        svg.append("circle").attr("cx", familyX).attr("cy", familyY).attr("r", familyR).attr("fill", defaultFamilyColor);
        svg.append("circle").attr("cx", childX).attr("cy", childY).attr("r", personR).attr("fill", personColor(1));

        const label = (text: string, x: number, y: number) => {
            svg.append("text").text(text).attr("x", x).attr("y", y)
                .attr("text-anchor", "middle").style("font-size", labelFontSize);
        };

        label(translate("about.diagram.parent1"), parentLeftX, parentsY - personR - 5);
        label(translate("about.diagram.parent2"), parentRightX, parentsY - personR - 5);
        label(translate("about.diagram.family"), familyX, familyY - familyR - 5);
        label(translate("about.diagram.child"), childX, childY + personR + 18);
    }

    $effect(() => {
        if (open && diagramEl && $t) {
            renderDiagram($t);
        }
    });

    export function show() {
        open = true;
    }

    function close() {
        open = false;
    }
</script>

<Modal {open} title={$t("about.title")} size="lg" scroll onclose={close} testid="about-modal">
    {#snippet body()}
        <img src="/assets/logo_color.webp" alt="" width="84" height="84" class="logo" />

        <section>
            <h6>{$t("about.heading")}</h6>
            <p>{$t("about.intro")}</p>
        </section>

        <section>
            <h6>{$t("about.familyRulesTitle")}</h6>
            <p>{$t("about.familyRulesIntro")}</p>
            <div class="about-diagram" bind:this={diagramEl}></div>
            <p>{$t("about.familyRulesNote")}</p>
            <ul>
                <li>{$t("about.rule1")}</li>
                <li>{$t("about.rule2")}</li>
                <li>{$t("about.rule3")}</li>
                <li>{$t("about.rule4")}</li>
                <li>{$t("about.rule5")}</li>
                <li>{$t("about.rule6")}</li>
                <li>{$t("about.rule7")}</li>
                <li>{$t("about.rule8")}</li>
                <li>{$t("about.rule9")}</li>
            </ul>
        </section>

        <section>
            <h6>{$t("about.namesakesTitle")}</h6>
            <p>{$t("about.namesakesText")}</p>
        </section>

        <section>
            <h6>{$t("about.sharingTitle")}</h6>
            <p>{$t("about.sharingText1")}</p>
            <p>{$t("about.sharingText2")}</p>
            <p>
                <b>{$t("about.sharingWarning")}</b>{$t("about.sharingWarningText")} <i>@gmail.com</i>
            </p>
        </section>

        <section>
            <h6>{$t("about.problemsTitle")}</h6>
            <p>
                {$t("about.problemsText")}
                <a href="mailto:danilasergeevich@gmail.com?subject=stemma">{$t("about.problemsEmail")}</a>.
            </p>
        </section>
    {/snippet}

    {#snippet footer()}
        <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.ok")}</button>
    {/snippet}
</Modal>

<style>
    .logo {
        display: block;
        margin: 0 auto 12px;
    }

    section {
        margin-top: 16px;
    }

    section:first-of-type {
        margin-top: 0;
    }

    section h6 {
        font-weight: var(---fw-section);
        margin-bottom: 6px;
    }

    section p {
        margin-bottom: 8px;
        font-size: var(---fs-body);
        color: var(---text-secondary);
    }

    .about-diagram {
        width: 100%;
        max-width: 360px;
        height: 220px;
        margin: 8px auto;
        display: block;
    }

    ul {
        padding-left: 1.2rem;
        font-size: var(---fs-body);
        color: var(---text-secondary);
    }

    ul li {
        margin-bottom: 4px;
    }
</style>
