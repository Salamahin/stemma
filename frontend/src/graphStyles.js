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

// Person colour by age, in a few clearly different steps (ageSteps.ts) from
// warm (oldest) to cool (youngest): on small nodes the eye tells another colour
// apart, not a slightly different shade. Fewer steps take evenly spaced colours.
const AGE_STEP_ANCHORS = ["#7f5539", "#c8782f", "#b8a12a", "#5f9a4b", "#2a9187", "#2f62c9"];
const ageColor = d3.piecewise(d3.interpolateLab, AGE_STEP_ANCHORS);
/** People with no date and no dated relative: no step to put them in. */
export const undatedPersonColor = "#9aa5b1";

/** Colour of age step `step` of `count` (0 = the oldest); null = undated. */
export function personColor(step, count) {
    if (step == null || !count) return undatedPersonColor;
    return ageColor(count > 1 ? step / (count - 1) : 1);
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
