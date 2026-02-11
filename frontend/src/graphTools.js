import * as d3 from "d3";
import {
    personR, familyR, defaultFamilyColor, shadedNodeColor,
    relationsColor, shadedRelationColor, childRelationWidth,
    familyRelationWidth, shadedRelationWidth, labelFontSize,
    personColor, addArrowMarkers
} from "./graphStyles";

export function makeNodesAndRelations(people, families) {
    let nodes = [
        ...people.map((p) => ({
            id: normalizeId("person", p.id),
            name: p.name,
            type: "person",
        })),
        ...families.map((f) => ({
            id: normalizeId("family", f.id),
            type: "family",
        })),
    ];

    let famlyToChildren = families.flatMap((f) =>
        f.children.map((c) => ({
            id: `${f.id}_${c}`,
            source: normalizeId("family", f.id),
            target: normalizeId("person", c),
            type: "familyToChild",
        }))
    );

    let spouseToFamily = families.flatMap((f) =>
        f.parents.map((p) => ({
            id: `${p}_${f.id}`,
            source: normalizeId("person", p),
            target: normalizeId("family", f.id),
            type: "spouseToFamily",
        })))

    let relations = [...famlyToChildren, ...spouseToFamily];

    return [nodes, relations]
}

export function initChart(svgSelector) {
    let svg = d3.select(svgSelector);
    addArrowMarkers(svg);


    svg.append("g").attr("class", "main");

    return svg
}


let coordinatesCache = new Map()

export function loadCoordinates(stemmaId) {
    const coordsObj = JSON.parse(localStorage.getItem(`coords-${stemmaId}`));
    if (coordsObj) coordinatesCache = new Map(Object.entries(coordsObj));
}

export function saveCoordinates(stemmaId) {
    localStorage.setItem(`coords-${stemmaId}`, JSON.stringify(Object.fromEntries(coordinatesCache)));
}

export function configureSimulation(svg, nodes, relations, width, height) {
    return d3
        .forceSimulation(nodes)
        .force(
            "link",
            d3.forceLink(relations).id((node) => node.id).strength(2).distance(85)
        )
        .force("x", d3.forceX().x(width * 0.5).strength(0.05))
        .force("y", d3.forceY().y(height * 0.5).strength(0.05))
        .force(
            "collide",
            d3.forceCollide().radius((d) => d.r * 20)
        )
        .force("repelForce", d3.forceManyBody().strength(-1500).distanceMin(85))
        .velocityDecay(0.8)
        .on("tick", () => {
            svg.select("g.main")
                .selectAll("g")
                .attr("transform", (d) => {
                    coordinatesCache.set(d.id, [d.x, d.y])
                    return "translate(" + d.x + "," + d.y + ")"
                });

            svg.selectAll("line")
                .attr("x1", (d) => d.source.x)
                .attr("y1", (d) => d.source.y)
                .attr("x2", (d) => d.target.x)
                .attr("y2", (d) => d.target.y);
        });
}

export function updateSimulation(simulation, nodes, relations) {
    simulation.nodes(nodes)
    simulation.force("link").links(relations)
    simulation.velocityDecay(0.8)
    simulation.alphaTarget(0.3).restart()
}

export function makeDrag(svg, simulation, stemmaId, onDragStart, onDragEnd) {
    function drag() {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
            if (onDragStart) onDragStart();
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            if (!event.subject.fixed) {
                event.subject.fx = null;
                event.subject.fy = null;
            }

            if (stemmaId) saveCoordinates(stemmaId)
            if (onDragEnd) onDragEnd();
        }

        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    svg.select("g.main").selectAll("g").call(drag());
}

export function normalizeId(suffix, id) {
    return `${suffix}_${id}`
}

export function denormalizeId(id) {
    return id.split("_")[1]
}

export function mergeData(svg, nodes, relations, widht, height, ignoreLocations) {
    svg.select("g.main")
        .selectAll("line")
        .data(relations, (r) => r.id)
        .join(
            (enter) => enter.append("line").lower(),
            (update) => update,
            (exit) => exit.remove()
        );

    nodes.forEach(n => {
        let x, y;
        if (!ignoreLocations && coordinatesCache.has(n.id)) {
            [x, y] = coordinatesCache.get(n.id)
        } else {
            x = widht / 2;
            y = height / 2
        }

        n.x = x
        n.y = y
    })

    svg.select("g.main")
        .selectAll("g")
        .data(nodes, (n) => n.id)
        .join(
            (enter) => {
                let people = enter
                    .filter(n => n.type == "person")
                    .append("g")
                    .attr("id", n => n.id);
                people.append("circle");
                people.append("text");

                enter
                    .filter(n => n.type == "family")
                    .append("g")
                    .attr("id", n => n.id)
                    .append("circle")
            },
            (update) => {
                update.select("text").text((node) => node.name);
            },
            (exit) => exit.remove()
        );
}

export function renderChart(svg, highlight, stemmaIndex) {
    function getNodeColor(node) {
        if (node.type == "person") {
            let d = stemmaIndex.lineage(denormalizeId(node.id)).generation / stemmaIndex.maxGeneration();
            return personColor(d);
        } else {
            return defaultFamilyColor;
        }
    }

    function lineHighlighted(line) {
        let relatesToSelectedFamilies = highlight.familyIsHighlighted(denormalizeId(line.source.id)) || highlight.familyIsHighlighted(denormalizeId(line.target.id));
        let relatesToSelectedPeople = highlight.personIsHighlighted(denormalizeId(line.source.id)) || highlight.personIsHighlighted(denormalizeId(line.target.id));

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

    let circles = svg.selectAll("circle")

    circles
        .filter((t) => t.type == "person")
        .attr("fill", (node) => (highlight.personIsHighlighted(denormalizeId(node.id)) ? getNodeColor(node) : shadedNodeColor))
        .attr("r", personR)

    circles
        .filter((t) => t.type == "family")
        .attr("fill", (node) => (highlight.familyIsHighlighted(denormalizeId(node.id)) ? defaultFamilyColor : shadedNodeColor))
        .attr("r", familyR)

    svg.select("g.main")
        .selectAll("g")
        .select("text")
        .style("fill", (node) => (highlight.personIsHighlighted(denormalizeId(node.id)) ? null : shadedNodeColor))
        .attr("cursor", "pointer")
        .attr("font-weight", null);

    svg.select("g.main")
        .selectAll("g")
        .attr("cursor", "pointer")

    svg.selectAll("text")
        .raise()
        .text((node) => node.name)
        .style("font-size", labelFontSize)
        .attr("dy", 40)
        .attr("dx", -personR);
}