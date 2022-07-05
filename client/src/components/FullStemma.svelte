<script lang="ts">
    import * as d3 from "d3";
    import { Stemma } from "../model";
    import { Lineage, Generation } from "../generation";
    import { onMount } from "svelte";

    let personR = 15;
    let hoveredPersonR = 20;
    let familyR = 5;

    let defaultFamilyColor = "#326f93";
    let shadedNodeColor = "#d3d3d3";

    let relationsColor = "#181818";

    let childRelationWidth = 0.5;
    let familyRelationWidth = 2.0;

    export let stemma: Stemma;

    let nodes = [];
    let relations = [];
    let lineages = new Map<string, Generation>();
    let max_generation = 0;

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
                connects: [...f.children, ...f.parents],
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

        lineages = new Lineage(stemma).lineages();
        max_generation = Math.max(...[...lineages.values()].map((p) => p.generation));
    }

    function getNodeColor(node) {
        return node.type == "person" ? d3.interpolatePlasma(lineages.get(node.id).generation / max_generation) : defaultFamilyColor;
    }

    function forceGraph(nodes, links) {
        const width = window.innerWidth,
            height = window.innerHeight;

        const simulation = d3
            .forceSimulation(nodes)
            .force(
                "link",
                d3
                    .forceLink(links)
                    .id((node) => node.id)
                    .distance(100)
                    .strength(1.5)
            )
            .force(
                "collide",
                d3.forceCollide().radius((d) => d.r * 20)
            )
            .force("repelForce", d3.forceManyBody().strength(-300).distanceMin(20))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter())
            .on("tick", ticked);

        const svg = d3
            .select("#chart")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [-width / 2, -height / 2, width, height])
            .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

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

        const link = svg
            .append("g")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", "#c7b7b7")
            .attr("stroke-width", (relation) => (relation.type == "familyToChild" ? childRelationWidth + "px" : familyRelationWidth + "px"))
            .attr("marker-end", (relation) => (relation.type == "familyToChild" ? "url(#arrow-to-person)" : "url(#arrow-to-family)"));

        const vertexGroup = svg.append("g").attr("class", "nodes");

        const vertices = vertexGroup
            .selectAll("g")
            .data(nodes)
            .join(
                (enter) => enter.append("g"),
                (update) => update,
                (exit) => exit.remove()
            )
            .call(drag());

        vertices
            .append("circle")
            .attr("fill", (node) => getNodeColor(node))
            .attr("r", (node) => (node.type == "person" ? personR : familyR))
            .on("mouseenter", (event, node) => {
                if (node.type == "person") {
                    let selectedLineage = lineages.get(node.id);

                    let nodes = vertices.selectAll("circle");

                    nodes
                        .filter((t) => t.type == "person")
                        .filter((t) => !selectedLineage.relativies.has(t.id))
                        .attr("fill", shadedNodeColor);

                    nodes
                        .filter((t) => t.type == "family")
                        .filter((t) => !selectedLineage.families.has(t.id))
                        .attr("fill", shadedNodeColor);

                    nodes.filter((t) => t.id == node.id).attr("r", hoveredPersonR);

                    svg.selectAll("line")
                        .filter((t) => {
                            let relatesToSelectedFamilies = selectedLineage.families.has(t.source.id) || selectedLineage.families.has(t.target.id);
                            let relatesToSelectedPeople = selectedLineage.relativies.has(t.source.id) || selectedLineage.relativies.has(t.target.id);

                            let related = relatesToSelectedFamilies && relatesToSelectedPeople;
                            return !related;
                        })
                        .attr("stroke", "#c7b7b7")
                        .attr("stroke-width", "0.1px")
                        .attr("marker-end", null);

                    vertexGroup
                        .selectAll("g")
                        .filter((node) => {
                            return !selectedLineage.relativies.has(node.id);
                        })
                        .selectAll("text")
                        .style("fill", shadedNodeColor);
                }
            })
            .on("mouseleave", (_event, _node) => {
                vertices
                    .selectAll("circle")
                    .attr("fill", (node) => getNodeColor(node))
                    .attr("r", (node) => (node.type == "person" ? personR : familyR));

                svg.selectAll("line")
                    .attr("stroke", "#c7b7b7")
                    .attr("stroke-width", (relation) => (relation.type == "familyToChild" ? childRelationWidth + "px" : familyRelationWidth + "px"))
                    .attr("marker-end", (relation) => (relation.type == "familyToChild" ? "url(#arrow-to-person)" : "url(#arrow-to-family)"));

                svg.selectAll("text").style("fill", null);
            });

        vertices
            .append("text")
            .text((node) => node.name)
            .style("font-size", "15px")
            .attr("dy", personR * 2)
            .attr("dx", -personR)
            .attr("relatedId", (node) => node.id);

        function ticked() {
            link.attr("x1", (d) => d.source.x)
                .attr("y1", (d) => d.source.y)
                .attr("x2", (d) => d.target.x)
                .attr("y2", (d) => d.target.y);

            vertices.attr("transform", (d) => "translate(" + d.x + "," + d.y + ")");
        }

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
    }

    onMount(() => {
        forceGraph(nodes, relations);
    });
</script>

<svg id="chart" />

<style>
    #chart {
        width: 100%;
        height: 100%;
    }
</style>
