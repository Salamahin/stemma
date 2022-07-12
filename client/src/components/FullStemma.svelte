<script lang="ts">
    import * as d3 from "d3";
    import { Stemma, StoredPerson } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { LineageSelectionController, StackedSelectionController } from "../selectionController";

    const dispatch = createEventDispatcher();

    let personR = 15;
    let hoveredPersonR = 20;
    let familyR = 5;

    let defaultFamilyColor = "#326f93";
    let shadedNodeColor = "#d3d3d3";

    let relationsColor = "#808080";
    let shadedRelationColor = "#a9a9a9";

    let childRelationWidth = "0.5px";
    let familyRelationWidth = "1.5px";
    let shadedRelationWidth = "0.1px";

    export let stemma: Stemma;
    export let stemmaIndex: StemmaIndex;
    export let selectionController: StackedSelectionController;

    let nodes = [];
    let relations = [];

    let svg;

    $: {
        nodes = [
            ...stemma.people.map((p) => ({
                id: p.id,
                name: p.name,
                type: "person",
            })),
            ...stemma.families.map((f) => ({
                id: f.id,
                type: "family",
            })),
        ];

        relations = [
            ...stemma.families.flatMap((f) =>
                f.children.map((c) => ({
                    id: `${f.id}_${c}`,
                    source: f.id,
                    target: c,
                    type: "familyToChild",
                }))
            ),
            ...stemma.families.flatMap((f) =>
                f.parents.map((p) => ({
                    id: `${p}_${f.id}`,
                    source: p,
                    target: f.id,
                    type: "spouseToFamily",
                }))
            ),
        ];

        updateGraph(nodes, relations);
    }

    function getNodeColor(node) {
        if (node.type == "person") {
            let d = stemmaIndex.lineage(node.id).generation / stemmaIndex.maxGeneration();
            return d3.interpolatePlasma(d);
        } else {
            return defaultFamilyColor;
        }
    }

    function updateGraph(nodes, relations) {
        if (!svg) return;

        let simulation = d3
            .forceSimulation(nodes)
            .force("link", d3.forceLink(relations).id((node) => node.id))
            .force("x", d3.forceX(window.innerWidth / 2).strength(0.2))
            .force("y", d3.forceY(window.innerHeight / 2).strength(0.2))
            .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
            .force("collide", d3.forceCollide().radius((d) => d.r * 20))
            .force("repelForce", d3.forceManyBody().strength(-1500).distanceMin(85))
            .on("tick", () => {
                svg.selectAll("line")
                    .attr("x1", (d) => d.source.x)
                    .attr("y1", (d) => d.source.y)
                    .attr("x2", (d) => d.target.x)
                    .attr("y2", (d) => d.target.y);

                svg.select("g.main")
                    .selectAll("g")
                    .attr("transform", (d) => "translate(" + d.x + "," + d.y + ")");
            });

        function drag() {
            function dragstarted(event) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }

            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }

            function dragended(event) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }

            return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
        }

        function highlight() {
            function lineHighlighted(line) {
                let relatesToSelectedFamilies = selectionController.familyIsSelected(line.source.id) || selectionController.familyIsSelected(line.target.id);
                let relatesToSelectedPeople = selectionController.personIsSelected(line.source.id) || selectionController.personIsSelected(line.target.id);

                return relatesToSelectedFamilies && relatesToSelectedPeople;
            }

            function lineFill(line) {
                if (!lineHighlighted(line)) return shadedRelationColor;
                else return relationsColor;
            }

            function lineWidth(line) {
                if (!lineHighlighted(line)) return shadedRelationWidth;
                else if (line.type == "familyToChild") return childRelationWidth;
                else return familyRelationWidth;
            }

            function markerEnd(line) {
                if (!lineHighlighted(line)) return null;
                else if (line.type == "familyToChild") return "url(#arrow-to-person)";
                else return "url(#arrow-to-family)";
            }

            svg.selectAll("line")
                .attr("stroke", (line) => lineFill(line))
                .attr("stroke-width", (line) => lineWidth(line))
                .attr("marker-end", (line) => markerEnd(line));

            let circles = svg.selectAll("circle");

            circles
                .filter((t) => t.type == "person")
                .attr("fill", (node) => (selectionController.personIsSelected(node.id) ? getNodeColor(node) : shadedNodeColor));

            circles
                .filter((t) => t.type == "family")
                .attr("fill", (node) => (selectionController.familyIsSelected(node.id) ? defaultFamilyColor : shadedNodeColor));

            svg.select("g.main")
                .selectAll("g")
                .select("text")
                .style("fill", (node) => (selectionController.personIsSelected(node.id) ? null : shadedNodeColor));
        }

        svg.select("g.main")
            .selectAll("line")
            .data(relations, (r) => r.id)
            .join(
                (enter) => enter.append("line").lower(),
                (update) => update,
                (exit) => exit.remove()
            );

        svg.select("g.main")
            .selectAll("g")
            .data(nodes, (n) => n.id)
            .join(
                (enter) => {
                    let g = enter.append("g");
                    g.append("circle");
                    g.append("text");
                },
                (update) => {
                    update.select("text").text((node) => node.name);
                },
                (exit) => exit.remove()
            );

        svg.selectAll("text")
            .raise()
            .text((node) => node.name)
            .style("font-size", "15px")
            .attr("dy", personR * 2)
            .attr("dx", -personR);

        svg.selectAll("circle")
            .attr("fill", (node) => getNodeColor(node))
            .attr("r", (node) => (node.type == "person" ? personR : familyR))
            .on("mouseenter", (event, node) => {
                if (node.type == "person") {
                    selectionController.push(new LineageSelectionController(stemmaIndex, node.id));

                    svg.selectAll("circle")
                        .filter((t) => t.id == node.id)
                        .attr("r", hoveredPersonR);

                    highlight();
                }
            })
            .on("mouseleave", (_event, node) => {
                if (node.type == "person") {
                    selectionController.pop();

                    svg.selectAll("circle").attr("r", (node) => (node.type == "person" ? personR : familyR));

                    highlight();
                }
            })
            .on("click", (event, node) => {
                if (selectionController.personIsSelected(node.id)) {
                    let selectedPerson = stemmaIndex.get(node.id);
                    dispatch("personSelected", selectedPerson);
                }
            });

        highlight();
        svg.select("g.main").selectAll("g").call(drag());
    }

    onMount(() => {
        svg = d3.select("#chart");

        const defs = svg.append("defs");
        defs.append("marker")
            .attr("id", "arrow-to-family")
            .attr("viewBox", "0 0 10 6")
            .attr("refX", 16)
            .attr("refY", 3)
            .attr("markerWidth", 10)
            .attr("markerHeight", 6)
            .attr("markerUnits", "userSpaceOnUse")
            .attr("orient", "auto")
            .style("fill", relationsColor)
            .append("path")
            .attr("d", "M 0 0 L 10 3 L 0 6 Z");

        defs.append("marker")
            .attr("id", "arrow-to-person")
            .attr("viewBox", "0 0 10 6")
            .attr("refX", 26)
            .attr("refY", 3)
            .attr("markerWidth", 10)
            .attr("markerHeight", 6)
            .attr("markerUnits", "userSpaceOnUse")
            .attr("orient", "auto")
            .style("fill", relationsColor)
            .append("path")
            .attr("d", "M 0 0 L 10 3 L 0 6 Z");

        svg.append("g").attr("class", "main");

        svg.call(
            d3.zoom().on("zoom", (e) => {
                d3.select("g.main").attr("transform", e.transform);
            })
        );
    });
</script>

<svg id="chart" class="w-100 p-3" style="height: 1200px;" />
