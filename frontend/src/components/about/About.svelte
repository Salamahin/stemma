<script lang="ts">
    import * as bootstrap from "bootstrap";
    import * as d3 from "d3";
    import { t } from "../../i18n";
    import {
        personR, familyR, defaultFamilyColor, relationsColor,
        childRelationWidth, familyRelationWidth, labelFontSize,
        personColor, addArrowMarkers
    } from "../../graphStyles";

    let modalEl;
    let diagramEl: HTMLDivElement;

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

        addArrowMarkers(svg);

        const parentsY = 40;
        const familyY = 110;
        const childY = 185;

        const parentLeftX = 90;
        const parentRightX = 270;
        const familyX = 180;
        const childX = 180;

        // Parent-left → family link
        svg.append("line")
            .attr("x1", parentLeftX).attr("y1", parentsY)
            .attr("x2", familyX).attr("y2", familyY)
            .attr("stroke", relationsColor)
            .attr("stroke-width", familyRelationWidth)
            .attr("marker-end", "url(#arrow-to-family)");

        // Parent-right → family link
        svg.append("line")
            .attr("x1", parentRightX).attr("y1", parentsY)
            .attr("x2", familyX).attr("y2", familyY)
            .attr("stroke", relationsColor)
            .attr("stroke-width", familyRelationWidth)
            .attr("marker-end", "url(#arrow-to-family)");

        // Family → child link
        svg.append("line")
            .attr("x1", familyX).attr("y1", familyY)
            .attr("x2", childX).attr("y2", childY)
            .attr("stroke", relationsColor)
            .attr("stroke-width", childRelationWidth)
            .attr("marker-end", "url(#arrow-to-person)");

        // Parent-left node
        svg.append("circle")
            .attr("cx", parentLeftX)
            .attr("cy", parentsY)
            .attr("r", personR)
            .attr("fill", personColor(0));

        // Parent-right node
        svg.append("circle")
            .attr("cx", parentRightX)
            .attr("cy", parentsY)
            .attr("r", personR)
            .attr("fill", personColor(0));

        // Family node
        svg.append("circle")
            .attr("cx", familyX)
            .attr("cy", familyY)
            .attr("r", familyR)
            .attr("fill", defaultFamilyColor);

        // Child node
        svg.append("circle")
            .attr("cx", childX)
            .attr("cy", childY)
            .attr("r", personR)
            .attr("fill", personColor(1));

        const label = (text: string, x: number, y: number) => {
            svg.append("text")
                .text(text)
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .style("font-size", labelFontSize);
        };

        label(translate("about.diagram.parent1"), parentLeftX, parentsY - personR - 5);
        label(translate("about.diagram.parent2"), parentRightX, parentsY - personR - 5);
        label(translate("about.diagram.family"), familyX, familyY - familyR - 5);
        label(translate("about.diagram.child"), childX, childY + personR + 18);
    }

    $: if (diagramEl && $t) {
        renderDiagram($t);
    }

    export function show() {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
</script>

<div class="modal fade" id="aboutModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="addStemmaLabel">{$t("about.title")}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <img src="assets/logo_color.webp" alt="" width="100" height="100" class="mx-auto d-block" />

                <div class="mt-4">
                    <h6>{$t("about.heading")}</h6>
                    <p>{$t("about.intro")}</p>
                </div>

                <div class="mt-4">
                    <h6>{$t("about.familyRulesTitle")}</h6>
                    <p>{$t("about.familyRulesIntro")}</p>
                    <div class="mx-auto d-block about-diagram" bind:this={diagramEl}></div>
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
                </div>

                <div class="mt-4">
                    <h6>{$t("about.namesakesTitle")}</h6>
                    <p>{$t("about.namesakesText")}</p>
                </div>
                <div class="mt-4">
                    <h6>{$t("about.sharingTitle")}</h6>
                    <p>{$t("about.sharingText1")}</p>
                    <p>{$t("about.sharingText2")}</p>
                    <p>
                        <b>{$t("about.sharingWarning")}</b>{$t("about.sharingWarningText")} <i>@gmail.com</i>
                    </p>
                </div>
                <div class="mt-4">
                    <h6>{$t("about.problemsTitle")}</h6>
                    <p>
                        {$t("about.problemsText")}
                        <a href="mailto:danilasergeevich@gmail.com?subject=stemma">{$t("about.problemsEmail")}</a>.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.ok")}</button>
            </div>
        </div>
    </div>
</div>

<style>
    .about-diagram {
        width: 100%;
        max-width: 360px;
        height: 220px;
    }
</style>
