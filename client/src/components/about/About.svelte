<script lang="ts">
    import * as bootstrap from "bootstrap";
    import * as d3 from "d3";
    import { onMount } from "svelte";
    import { t } from "../../i18n";

    let modalEl;
    let diagramEl: HTMLDivElement;

    const width = 360;
    const height = 220;

    function renderDiagram() {
        if (!diagramEl) return;
        diagramEl.innerHTML = "";

        const svg = d3
            .select(diagramEl)
            .append("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("width", "100%")
            .attr("height", "100%");

        const parentsY = 40;
        const familyY = 110;
        const childY = 185;

        const parentLeftX = 90;
        const parentRightX = 270;
        const familyX = 180;
        const childX = 180;

        const line = d3
            .line()
            .x((d: { x: number; y: number }) => d.x)
            .y((d: { x: number; y: number }) => d.y);

        svg.append("path")
            .attr(
                "d",
                line([
                    { x: parentLeftX, y: parentsY + 18 },
                    { x: familyX, y: familyY - 18 },
                ])
            )
            .attr("stroke", "#333")
            .attr("fill", "none");

        svg.append("path")
            .attr(
                "d",
                line([
                    { x: parentRightX, y: parentsY + 18 },
                    { x: familyX, y: familyY - 18 },
                ])
            )
            .attr("stroke", "#333")
            .attr("fill", "none");

        svg.append("path")
            .attr(
                "d",
                line([
                    { x: familyX, y: familyY + 18 },
                    { x: childX, y: childY - 18 },
                ])
            )
            .attr("stroke", "#333")
            .attr("fill", "none");

        const nodeStyle = {
            fill: "#fff",
            stroke: "#333",
            strokeWidth: 2,
        };

        svg.append("circle")
            .attr("cx", parentLeftX)
            .attr("cy", parentsY)
            .attr("r", 16)
            .attr("fill", nodeStyle.fill)
            .attr("stroke", nodeStyle.stroke)
            .attr("stroke-width", nodeStyle.strokeWidth);

        svg.append("circle")
            .attr("cx", parentRightX)
            .attr("cy", parentsY)
            .attr("r", 16)
            .attr("fill", nodeStyle.fill)
            .attr("stroke", nodeStyle.stroke)
            .attr("stroke-width", nodeStyle.strokeWidth);

        svg.append("circle")
            .attr("cx", familyX)
            .attr("cy", familyY)
            .attr("r", 10)
            .attr("fill", "#333");

        svg.append("circle")
            .attr("cx", childX)
            .attr("cy", childY)
            .attr("r", 16)
            .attr("fill", nodeStyle.fill)
            .attr("stroke", nodeStyle.stroke)
            .attr("stroke-width", nodeStyle.strokeWidth);

        const label = (text: string, x: number, y: number) => {
            svg.append("text")
                .text(text)
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("font-size", 12)
                .attr("fill", "#333");
        };

        label($t("about.diagram.parent1"), parentLeftX, parentsY - 22);
        label($t("about.diagram.parent2"), parentRightX, parentsY - 22);
        label($t("about.diagram.family"), familyX, familyY - 18);
        label($t("about.diagram.child"), childX, childY + 34);
    }

    onMount(() => {
        renderDiagram();
    });

    $: if (diagramEl) {
        // re-render on locale change
        renderDiagram();
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
