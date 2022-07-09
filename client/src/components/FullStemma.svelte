<script lang="ts">
    import * as d3 from "d3";
    import { Stemma, StoredPerson } from "../model";
    import { Lineage, Generation } from "../generation";
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    let personR = 15;
    let hoveredPersonR = 20;
    let familyR = 5;

    let defaultFamilyColor = "#326f93";
    let shadedNodeColor = "#d3d3d3";

    let relationsColor = "#181818";

    let childRelationWidth = 0.5;
    let familyRelationWidth = 2.0;

    export let stemma: Stemma;
    function personSelected(p: StoredPerson) {
        dispatch("personSelected", p)
    }

    let nodes = [];
    let relations = [];
    let lineages = new Map<string, Generation>();
    let max_generation = 0;

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

        lineages = new Lineage(stemma).lineages();
        max_generation = Math.max(...[...lineages.values()].map((p) => p.generation));

        updateGraph(nodes, relations);
    }

    function getNodeColor(node) {
        return node.type == "person" ? d3.interpolatePlasma(lineages.get(node.id).generation / max_generation) : defaultFamilyColor;
    }

    function updateGraph(nodes, relations) {
        if(!svg) return;

        let simulation = d3
            .forceSimulation(nodes)
            .force(
                "link",
                d3.forceLink(relations).id((node) => node.id)
            )

            .force("x", d3.forceX(window.innerWidth / 2).strength(0.5))
            .force("y", d3.forceY(window.innerHeight / 2).strength(0.5))
            .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
            .force(
                "collide",
                d3.forceCollide().radius((d) => d.r * 20)
            )
            .force("repelForce", d3.forceManyBody().strength(-2500).distanceMin(85))
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

        svg.select("g.main")
            .selectAll("line")
            .data(relations, (r) => r.id)
            .join(
                (enter) => enter.append("line").lower(),
                (update) => update,
                (exit) => exit.remove()
            )
            .attr("stroke", "#c7b7b7")
            .attr("stroke-width", (relation) => (relation.type == "familyToChild" ? childRelationWidth + "px" : familyRelationWidth + "px"))
            .attr("marker-end", (relation) => (relation.type == "familyToChild" ? "url(#arrow-to-person)" : "url(#arrow-to-family)"));

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
                    // let g = update.append("g");
                    // g.append("circle");
                    // g.append("text");
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
                    let selectedLineage = lineages.get(node.id);

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

                    let circles = svg.selectAll("circle");

                    circles
                        .filter((t) => t.type == "person")
                        .filter((t) => !selectedLineage.relativies.has(t.id))
                        .attr("fill", shadedNodeColor);

                    circles
                        .filter((t) => t.type == "family")
                        .filter((t) => !selectedLineage.families.has(t.id))
                        .attr("fill", shadedNodeColor);

                    circles.filter((t) => t.id == node.id).attr("r", hoveredPersonR);

                    svg.select("g.main")
                        .selectAll("g")
                        .filter((node) => !selectedLineage.relativies.has(node.id))
                        .select("text")
                        .style("fill", shadedNodeColor);
                }
            })
            .on("mouseleave", (_event, _node) => {
                svg.selectAll("line")
                    .attr("stroke", "#c7b7b7")
                    .attr("stroke-width", (relation) => (relation.type == "familyToChild" ? childRelationWidth + "px" : familyRelationWidth + "px"))
                    .attr("marker-end", (relation) => (relation.type == "familyToChild" ? "url(#arrow-to-person)" : "url(#arrow-to-family)"));

                svg.selectAll("circle")
                    .attr("fill", (node) => getNodeColor(node))
                    .attr("r", (node) => (node.type == "person" ? personR : familyR));

                svg.selectAll("text").style("fill", null);
            })
            .on("click", (event, node) => {
                let selectedPerson = stemma.people.find(p => p.id == node.id)
                personSelected(selectedPerson)
            })

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

<svg id="chart" class="w-100 p-3" style="height: 800px;" />