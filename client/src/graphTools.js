import * as d3 from "d3";

const personR = 15;
const familyR = 5;

const defaultFamilyColor = "#326f93";
const shadedNodeColor = "#d3d3d3";

const shadedRelationColor = "#a9a9a9";
const relationsColor = "#808080";

const childRelationWidth = "0.5px";
const familyRelationWidth = "2.5px";
const shadedRelationWidth = "0.1px";

export function makeNodesAndRelations(people, families) {
    let nodes = [
        ...people.map((p) => ({
            id: p.id,
            name: p.name,
            type: "person",
        })),
        ...families.map((f) => ({
            id: f.id,
            type: "family",
        })),
    ];

    let relations = [
        ...families.flatMap((f) =>
            f.children.map((c) => ({
                id: `${f.id}_${c}`,
                source: f.id,
                target: c,
                type: "familyToChild",
            }))
        ),
        ...families.flatMap((f) =>
            f.parents.map((p) => ({
                id: `${p}_${f.id}`,
                source: p,
                target: f.id,
                type: "spouseToFamily",
            }))
        ),
    ];

    return [nodes, relations]
}

export function initChart(svgSelector) {
    let svg = d3.select(svgSelector);
    let defs = svg.append("defs");

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

    return svg
}


let coordinatesCache = new Map()

export function loadCoordinates(stemmaId) {
    const coordsObj = JSON.parse(localStorage.getItem(`coords-${stemmaId}`));
    coordinatesCache = new Map(Object.entries(coordsObj));
}

export function saveCoordinates(stemmaId) {
    localStorage.setItem(`coords-${stemmaId}`, JSON.stringify(Object.fromEntries(coordinatesCache)));
}

export function configureSimulation(svg, nodes, relations, width, height) {
    return d3
        .forceSimulation(nodes)
        .force(
            "link",
            d3.forceLink(relations).id((node) => node.id).distance(85)
        )
        .force("x", d3.forceX().x(width * 0.5).strength(0.2))
        .force("y", d3.forceY().y(height * 0.5).strength(0.2))
        .force(
            "collide",
            d3.forceCollide().radius((d) => d.r * 20)
        )
        .force("repelForce", d3.forceManyBody().strength(-1500).distanceMin(85))
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
    simulation.alphaTarget(0.3).restart()
}

export function makeDrag(svg, simulation, stemmaId) {
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
            
            if(stemmaId) saveCoordinates(stemmaId)
        }

        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    svg.select("g.main").selectAll("g").call(drag());
}

export function normalizeId(suffix, id) {
    return `${suffix}_${id}`
}

export function mergeData(svg, nodes, relations, widht, height) {
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
        if (coordinatesCache.has(n.id)) {
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
                let g = enter.append("g").attr("id", n => normalizeId("person", n.id));
                g.append("circle");
                g.append("text");
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
            let d = stemmaIndex.lineage(node.id).generation / stemmaIndex.maxGeneration();
            return d3.interpolatePlasma(d);
        } else {
            return defaultFamilyColor;
        }
    }

    function lineHighlighted(line) {
        let relatesToSelectedFamilies = highlight.familyIsHighlighted(line.source.id) || highlight.familyIsHighlighted(line.target.id);
        let relatesToSelectedPeople = highlight.personIsHighlighted(line.source.id) || highlight.personIsHighlighted(line.target.id);

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
        .attr("fill", (node) => (highlight.personIsHighlighted(node.id) ? getNodeColor(node) : shadedNodeColor))
        .attr("r", personR)

    circles
        .filter((t) => t.type == "family")
        .attr("fill", (node) => (highlight.familyIsHighlighted(node.id) ? defaultFamilyColor : shadedNodeColor))
        .attr("r", familyR)

    svg.select("g.main")
        .selectAll("g")
        .select("text")
        .style("fill", (node) => (highlight.personIsHighlighted(node.id) ? null : shadedNodeColor))
        .attr("cursor", "pointer")
        .attr("font-weight", null);

    svg.select("g.main")
        .selectAll("g")
        .attr("cursor", "pointer")
        .filter(p => highlight.personIsHighlighted(p.id))
        .raise()

    svg.selectAll("text")
        .raise()
        .text((node) => node.name)
        .style("font-size", "15px")
        .attr("dy", 40)
        .attr("dx", -personR);
}