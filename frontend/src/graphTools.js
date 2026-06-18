import * as d3 from "d3";
import { layoutGreedy, layoutRemoveOverlaps } from "d3fc-label-layout";
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
    const markers = addArrowMarkers(svg);

    svg.append("g").attr("class", "main");

    return { svg, markers };
}


let sessionPositions = new Map()
let cachedStemmaId = null
let activeLayoutCache = null

export function setSessionPosition(nodeId, x, y) {
    sessionPositions.set(nodeId, [x, y])
}

export function resetSessionPositions(stemmaId) {
    if (cachedStemmaId !== stemmaId) {
        sessionPositions = new Map()
        cachedStemmaId = stemmaId
    }
}

export function setActiveLayoutCache(cache) {
    activeLayoutCache = cache || null
}

export function configureSimulation(svg, nodes, relations, width, height) {
    const sim = d3
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
        .velocityDecay(0.8);

    sim.on("tick", () => {
        svg.select("g.main")
            .selectAll(D3_NODE_SELECTOR)
            .each(function (d) {
                if (!d) return;
                sessionPositions.set(d.id, [d.x, d.y]);
                if (activeLayoutCache) activeLayoutCache.set(d.id, d.x, d.y, d.vx ?? 0, d.vy ?? 0);
                this.setAttribute("transform", `translate(${d.x},${d.y})`);
            });

        svg.selectAll("line:not([class])").each(function (d) {
            if (!d) return;
            this.setAttribute("x1", d.source.x);
            this.setAttribute("y1", d.source.y);
            this.setAttribute("x2", d.target.x);
            this.setAttribute("y2", d.target.y);
        });
    });

    sim.on("end", () => {
        applyLabelLayout(svg, sim.nodes());
        if (activeLayoutCache) activeLayoutCache.save();
    });

    return sim;
}

export function applyLabelLayout(svg, nodes) {
    const persons = nodes.filter((n) => n.type === "person");
    if (persons.length === 0) return;

    const rects = persons.map((p) => {
        const t = document.querySelector(`#${CSS.escape(p.id)} text`);
        let w = 80, h = 20;
        if (t) {
            const bb = t.getBBox();
            w = bb.width + 4;
            h = bb.height + 4;
        }
        return {
            hidden: false,
            x: p.x - personR,
            y: p.y + 20,
            width: w,
            height: h,
            _origin: p,
            _w: w,
            _h: h,
        };
    });

    const strategy = layoutRemoveOverlaps(layoutGreedy());
    const placed = strategy(rects);

    persons.forEach((p, i) => {
        const slot = placed[i];
        const before = rects[i];
        const dx = slot.x - p.x;
        const dy = slot.y - p.y;
        const node = svg.select(`#${CSS.escape(p.id)}`);
        node.select("text")
            .attr("dx", dx)
            .attr("dy", dy + before._h * 0.7)
            .style("display", slot.hidden ? "none" : null);
    });
}

export function updateSimulation(simulation, nodes, relations) {
    simulation.nodes(nodes)
    simulation.force("link").links(relations)
    simulation.velocityDecay(0.8)
    simulation.alphaTarget(0.3).restart()
}

export function makeDrag(svg, simulation, pinnedPeople, onDragStart, onDragEnd) {
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

            if (pinnedPeople && event.subject.type === "person") {
                const personId = denormalizeId(event.subject.id);
                if (pinnedPeople.isPinned(personId)) {
                    pinnedPeople.updatePosition(personId, event.subject.x, event.subject.y);
                }
            }
            if (onDragEnd) onDragEnd();
        }

        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    svg.select("g.main").selectAll(D3_NODE_SELECTOR).call(drag());
}

export const PERSON_PREFIX = "person_";
export const FAMILY_PREFIX = "family_";
const D3_NODE_SELECTOR = `g[id^='${PERSON_PREFIX}'], g[id^='${FAMILY_PREFIX}']`;

export function normalizeId(suffix, id) {
    return `${suffix}_${id}`
}

export function denormalizeId(id) {
    return id.split("_")[1]
}

export function mergeData(svg, nodes, relations, width, height, initialPositions, pinnedPeople, ignoreCache) {
    // Foreign DOM (ghost edges/nodes, drag link-lines) lives in g.main too.
    // selectAll must match only d3-bound elements or the join's keyFn dereferences
    // `undefined` and exit.remove() wipes the decorations.
    svg.select("g.main")
        .selectAll("line:not([class])")
        .data(relations, (r) => r.id)
        .join(
            (enter) => enter.append("line").lower(),
            (update) => update,
            (exit) => exit.remove()
        );

    nodes.forEach(n => {
        let pos;
        let vel;
        // n.hadKnownPosition: this node's position came from a stable source
        // (pinned/cache/session) — i.e. it existed in the layout before this
        // merge. Callers in edit mode use this to pin existing nodes so the
        // subsequent sim.tick() places only new nodes instead of drifting
        // the whole graph on every data change.
        n.hadKnownPosition = false;
        if (!ignoreCache) {
            if (n.type === "person" && pinnedPeople) {
                const personId = denormalizeId(n.id);
                const pinned = pinnedPeople.getPosition(personId);
                if (pinned) {
                    pos = pinned;
                    n.hadKnownPosition = true;
                }
            }
            if (!pos && activeLayoutCache && activeLayoutCache.has(n.id)) {
                const cached = activeLayoutCache.get(n.id);
                pos = [cached.x, cached.y];
                vel = [cached.vx, cached.vy];
                n.hadKnownPosition = true;
            }
            if (!pos && sessionPositions.has(n.id)) {
                pos = sessionPositions.get(n.id);
                n.hadKnownPosition = true;
            }
            if (!pos && initialPositions && initialPositions.has(n.id)) {
                pos = initialPositions.get(n.id);
            }
        }
        if (!pos) {
            pos = [width / 2, height / 2];
        }

        n.x = pos[0];
        n.y = pos[1];
        if (vel) {
            n.vx = vel[0];
            n.vy = vel[1];
        }
    })

    svg.select("g.main")
        .selectAll(D3_NODE_SELECTOR)
        .data(nodes, (n) => n.id)
        .join(
            (enter) => {
                let people = enter
                    .filter(n => n.type == "person")
                    .append("g")
                    .attr("id", n => n.id);
                people.append("circle");
                people.append("text")
                    .attr("dx", -personR)
                    .attr("dy", 40);

                enter
                    .filter(n => n.type == "family")
                    .append("g")
                    .attr("id", n => n.id)
                    .append("circle");
            },
            (update) => {
                update.select("text").text((node) => node.name);
            },
            (exit) => exit.remove()
        );
}

export function renderChart(svg, highlight, stemmaIndex, markers) {
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
        if (line.type == "familyToChild") return markers.person;
        else return markers.family;
    }

    // Ghost elements live inside g.main but have no datum; skip them so we
    // never dereference t/line/node on undefined.
    const hasDatum = (d) => d != null;

    svg.selectAll("line:not([class])")
        .filter((line) => hasDatum(line))
        .attr("stroke", (line) => lineFill(line))
        .attr("stroke-width", (line) => lineWidth(line))
        .attr("marker-end", (line) => markerEnd(line));

    let circles = svg.selectAll("circle").filter((t) => hasDatum(t))

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
        .filter((d) => hasDatum(d) && d.type === "person")
        .select("text")
        .style("fill", (node) => (highlight.personIsHighlighted(denormalizeId(node.id)) ? null : shadedNodeColor))
        .attr("cursor", "pointer")
        .attr("font-weight", null);

    svg.select("g.main")
        .selectAll("g")
        .filter((d) => hasDatum(d) && (d.type === "person" || d.type === "family"))
        .attr("cursor", "pointer")

    svg.selectAll("text")
        .filter((node) => hasDatum(node) && node.type === "person")
        .raise()
        .text((node) => node.name)
        .style("font-size", labelFontSize);
}
