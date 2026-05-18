import * as d3 from "d3";

// Node sizes
export const personR = 15;
export const familyR = 5;

// Node colors
export const defaultFamilyColor = "#326f93";
export const shadedNodeColor = "#d3d3d3";

// Link styles
export const relationsColor = "#808080";
export const shadedRelationColor = "#a9a9a9";
export const childRelationWidth = "0.5px";
export const familyRelationWidth = "2.5px";
export const shadedRelationWidth = "0.1px";

// Text
export const labelFontSize = "15px";

// Arrow marker path
export const arrowPath = "M 0 0 L 10 3 L 0 6 Z";

// Person color by generation depth
export function personColor(generationRatio) {
    return d3.interpolatePlasma(generationRatio);
}

// Marker IDs must be unique document-wide; `url(#id)` resolves to the
// first matching element in tree order, and if that element sits inside
// a hidden subtree the browser won't render it.
let _markerScope = 0;

export function addArrowMarkers(svg) {
    const scope = ++_markerScope;
    const familyId = `arrow-to-family-${scope}`;
    const personId = `arrow-to-person-${scope}`;

    let defs = svg.select("defs");
    if (defs.empty()) defs = svg.append("defs");

    defs.append("marker")
        .attr("id", familyId)
        .attr("viewBox", "0 0 10 6")
        .attr("refX", 16)
        .attr("refY", 3)
        .attr("markerWidth", 10)
        .attr("markerHeight", 6)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .style("fill", relationsColor)
        .append("path")
        .attr("d", arrowPath);

    defs.append("marker")
        .attr("id", personId)
        .attr("viewBox", "0 0 10 6")
        .attr("refX", 26)
        .attr("refY", 3)
        .attr("markerWidth", 10)
        .attr("markerHeight", 6)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .style("fill", relationsColor)
        .append("path")
        .attr("d", arrowPath);

    return { family: `url(#${familyId})`, person: `url(#${personId})` };
}
