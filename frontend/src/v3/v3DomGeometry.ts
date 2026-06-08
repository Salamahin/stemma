import { denormalizeId } from "../graphTools";
import { isPendingId } from "./pendingState";

export type NodeRef = { kind: "person" | "family"; id: string };

export function clientToSvgPoint(
    svgEl: SVGSVGElement,
    clientX: number,
    clientY: number,
): { x: number; y: number } {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const mainG = svgEl.querySelector("g.main") as SVGGElement | null;
    const ctm = mainG?.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const out = pt.matrixTransform(ctm.inverse());
    return { x: out.x, y: out.y };
}

export function nodeCenter(g: SVGGElement): { x: number; y: number } | null {
    const t = g.getAttribute("transform");
    if (!t) return null;
    const match = t.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
    if (!match) return null;
    return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
}

export function findNodeUnder(x: number, y: number): { ref: NodeRef; el: SVGGElement } | null {
    const el = document.elementFromPoint(x, y);
    const g = el?.closest?.("g[id^='person_'], g[id^='family_']") as SVGGElement | null;
    if (!g) return null;
    const kind = g.id.startsWith("person_") ? "person" : "family";
    const id = denormalizeId(g.id);
    if (kind === "person" && isPendingId(id)) return null;
    return { ref: { kind, id }, el: g };
}
