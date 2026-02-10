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

// Add arrow marker defs to an SVG selection
export function addArrowMarkers(svg) {
    let defs = svg.select("defs");
    if (defs.empty()) defs = svg.append("defs");

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
        .attr("d", arrowPath);

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
        .attr("d", arrowPath);
}
