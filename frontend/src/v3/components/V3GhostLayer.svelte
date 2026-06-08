<script lang="ts">
    import { normalizeId } from "../../graphTools";
    import {
        personR,
        familyR,
        labelFontSize,
        familyRelationWidth,
        childRelationWidth,
        arrowPath,
    } from "../../graphStyles";
    import { t } from "../../i18n";
    import type { StemmaIndex } from "../../stemmaIndex";
    import type { FocusedId } from "../focusGesture";
    import {
        deriveGhostLayout,
        FOCUSED_FAMILY_REF,
        realFamilyIdFromRef,
        type GhostKind,
    } from "../ghostHelpers";
    import { nodeCenter } from "../v3DomGeometry";
    import { trimToCircle } from "../ghostEdgeGeometry";

    type Props = {
        focusedId: FocusedId | null;
        stemmaIndex: StemmaIndex | null;
        stemmaChartReady: boolean;
        onghostClick: (
            kind: GhostKind,
            focused: FocusedId,
            ghostPos: { x: number; y: number },
            existingFamilyId?: string,
        ) => void;
        onpositionsChange: (positions: Array<{ x: number; y: number }>) => void;
    };

    let { focusedId, stemmaIndex, stemmaChartReady, onghostClick, onpositionsChange }: Props = $props();

    type Pos = { x: number; y: number };

    const SVG_NS = "http://www.w3.org/2000/svg";
    const GHOST_FADE_MS = 200;
    const GHOST_COLOR = "#6c757d";
    const GHOST_ARROW_TO_FAMILY_ID = "v3-ghost-arrow-to-family";
    const GHOST_ARROW_TO_PERSON_ID = "v3-ghost-arrow-to-person";

    let fadingOutGhostEls: Element[] = [];

    function fadeOutAndRemove(els: Element[]): void {
        if (els.length === 0) return;
        for (const el of els) (el as HTMLElement | SVGElement).style.opacity = "0";
        fadingOutGhostEls = [...fadingOutGhostEls, ...els];
        setTimeout(() => {
            for (const el of els) el.parentNode?.removeChild(el);
            fadingOutGhostEls = fadingOutGhostEls.filter((e) => !els.includes(e));
        }, GHOST_FADE_MS);
    }

    function ensureGhostMarkers(svgEl: SVGSVGElement): void {
        if (svgEl.querySelector(`marker#${GHOST_ARROW_TO_FAMILY_ID}`)) return;
        let defs = svgEl.querySelector("defs") as SVGDefsElement | null;
        if (!defs) {
            defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement;
            svgEl.insertBefore(defs, svgEl.firstChild);
        }
        for (const id of [GHOST_ARROW_TO_FAMILY_ID, GHOST_ARROW_TO_PERSON_ID]) {
            const marker = document.createElementNS(SVG_NS, "marker") as SVGMarkerElement;
            marker.setAttribute("id", id);
            marker.setAttribute("viewBox", "0 0 10 6");
            marker.setAttribute("refX", "10");
            marker.setAttribute("refY", "3");
            marker.setAttribute("markerWidth", "10");
            marker.setAttribute("markerHeight", "6");
            marker.setAttribute("markerUnits", "userSpaceOnUse");
            marker.setAttribute("orient", "auto");
            const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
            path.setAttribute("d", arrowPath);
            path.style.fill = GHOST_COLOR;
            marker.appendChild(path);
            defs.appendChild(marker);
        }
    }

    $effect(() => {
        if (!stemmaChartReady) return;
        const svgEl = document.getElementById("chart") as unknown as SVGSVGElement | null;
        const mainG = svgEl?.querySelector("g.main") as SVGGElement | null;
        if (!svgEl || !mainG || !focusedId || !stemmaIndex) return;

        const focusDomId = normalizeId(focusedId.kind, focusedId.id);
        const focusEl = mainG.querySelector(`#${CSS.escape(focusDomId)}`) as SVGGElement | null;
        const origin = focusEl ? nodeCenter(focusEl) : null;
        if (!origin) return;

        const layout = deriveGhostLayout(focusedId, stemmaIndex);
        if (layout.families.length === 0 && layout.persons.length === 0) return;

        ensureGhostMarkers(svgEl);
        const labels = $t;
        const allGhostEls: SVGElement[] = [];

        const realFamilyCenter = (realId: string): Pos | null => {
            const el = mainG.querySelector(`#${CSS.escape(normalizeId("family", realId))}`) as SVGGElement | null;
            return el ? nodeCenter(el) : null;
        };

        // Resolve every family anchor (ghost / focused-real / existing-real) to a center point.
        const familyAnchor = new Map<string, Pos>();
        for (const f of layout.families) {
            familyAnchor.set(f.id, { x: origin.x + f.dx, y: origin.y + f.dy });
        }
        if (focusedId.kind === "family") familyAnchor.set(FOCUSED_FAMILY_REF, origin);
        for (const p of layout.persons) {
            if (familyAnchor.has(p.familyId)) continue;
            const realId = realFamilyIdFromRef(p.familyId);
            if (!realId) continue;
            const center = realFamilyCenter(realId);
            if (center) familyAnchor.set(p.familyId, center);
        }

        // Resolve every ghost person's position: relative to its real family center
        // when familyId points to a real family, otherwise relative to focused.
        const personPos = new Map<string, Pos>();
        for (const p of layout.persons) {
            const realRef = p.familyId === FOCUSED_FAMILY_REF || realFamilyIdFromRef(p.familyId) !== null;
            const base = realRef ? familyAnchor.get(p.familyId) ?? origin : origin;
            personPos.set(p.id, { x: base.x + p.dx, y: base.y + p.dy });
        }

        const makeLine = (
            source: Pos,
            target: Pos,
            edgeKind: "focusToFamily" | "familyToPerson",
            targetRadius: number,
        ): void => {
            const tip = trimToCircle(source.x, source.y, target.x, target.y, targetRadius);
            const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
            line.setAttribute("class", "v3-ghost-edge");
            line.setAttribute("x1", String(source.x));
            line.setAttribute("y1", String(source.y));
            line.setAttribute("x2", String(tip.x));
            line.setAttribute("y2", String(tip.y));
            if (edgeKind === "focusToFamily") {
                line.setAttribute("stroke-width", familyRelationWidth);
                line.setAttribute("marker-end", `url(#${GHOST_ARROW_TO_FAMILY_ID})`);
            } else {
                line.setAttribute("stroke-width", childRelationWidth);
                line.setAttribute("marker-end", `url(#${GHOST_ARROW_TO_PERSON_ID})`);
            }
            line.style.opacity = "0";
            mainG.appendChild(line);
            allGhostEls.push(line);
        };

        const makeGhostFamilyEl = (id: string, pos: Pos): void => {
            const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
            g.setAttribute("id", id);
            g.setAttribute("class", "v3-ghost-family");
            g.setAttribute("transform", `translate(${pos.x},${pos.y})`);
            g.style.opacity = "0";
            g.style.pointerEvents = "none";
            const c = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
            c.setAttribute("r", String(familyR));
            g.appendChild(c);
            mainG.appendChild(g);
            allGhostEls.push(g);
        };

        const makeGhostPersonEl = (
            id: string,
            pos: Pos,
            labelKey: string,
            kind: GhostKind,
            existingFamilyId: string | undefined,
        ): void => {
            const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
            g.setAttribute("id", id);
            g.setAttribute("class", "v3-ghost");
            g.setAttribute("transform", `translate(${pos.x},${pos.y})`);
            g.style.opacity = "0";
            const c = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
            c.setAttribute("r", String(personR));
            g.appendChild(c);
            const label = document.createElementNS(SVG_NS, "text") as SVGTextElement;
            label.setAttribute("class", "v3-ghost-label");
            label.setAttribute("dx", String(-personR));
            label.setAttribute("dy", "40");
            label.style.fontSize = labelFontSize;
            label.textContent = labels(labelKey);
            g.appendChild(label);
            mainG.appendChild(g);
            allGhostEls.push(g);

            const capturedFocused = focusedId;
            g.addEventListener("pointerup", (ev: PointerEvent) => {
                ev.stopPropagation();
                onghostClick(kind, capturedFocused, pos, existingFamilyId);
            });
        };

        // Render: ghost family circles → ghost person circles → edges.
        for (const f of layout.families) {
            const pos = familyAnchor.get(f.id);
            if (pos) makeGhostFamilyEl(f.id, pos);
        }
        for (const p of layout.persons) {
            const pos = personPos.get(p.id);
            if (!pos) continue;
            const existingFamilyId = realFamilyIdFromRef(p.familyId) ?? undefined;
            makeGhostPersonEl(p.id, pos, p.labelKey, p.kind, existingFamilyId);
        }

        // Anchor edges: focused ↔ ghost family (arrow at family for parent-role, at focused for child-role).
        for (const a of layout.anchorEdges) {
            const familyPos = familyAnchor.get(a.familyId);
            if (!familyPos) continue;
            if (a.focusedRole === "parent") {
                makeLine(origin, familyPos, "focusToFamily", familyR);
            } else {
                makeLine(familyPos, origin, "familyToPerson", personR);
            }
        }

        // Person ↔ family edges (arrow at family when person is incoming parent; at person when outgoing child).
        for (const p of layout.persons) {
            const pos = personPos.get(p.id);
            const anchorPos = familyAnchor.get(p.familyId);
            if (!pos || !anchorPos) continue;
            if (p.role === "parent") {
                makeLine(pos, anchorPos, "focusToFamily", familyR);
            } else {
                makeLine(anchorPos, pos, "familyToPerson", personR);
            }
        }

        let fadeInCancelled = false;
        requestAnimationFrame(() => {
            if (fadeInCancelled) return;
            for (const el of allGhostEls) el.style.opacity = "";
        });

        onpositionsChange([...familyAnchor.values(), ...personPos.values()]);

        return () => {
            fadeInCancelled = true;
            onpositionsChange([]);
            fadeOutAndRemove(allGhostEls);
        };
    });
</script>

<style>
    :global(g.v3-ghost) {
        opacity: 0.6;
        cursor: pointer;
        transition: opacity 200ms ease;
    }

    :global(g.v3-ghost > circle) {
        fill: none;
        stroke: #6c757d;
        stroke-width: 1.5px;
        stroke-dasharray: 5 3;
        pointer-events: all;
    }

    :global(g.v3-ghost .v3-ghost-label) {
        fill: #6c757d;
        pointer-events: none;
    }

    :global(line.v3-ghost-edge) {
        stroke: #6c757d;
        stroke-dasharray: 4 3;
        opacity: 0.5;
        pointer-events: none;
        transition: opacity 200ms ease;
    }

    :global(g.v3-ghost-family) {
        opacity: 0.5;
        cursor: default;
        transition: opacity 200ms ease;
        pointer-events: none;
    }

    :global(g.v3-ghost-family > circle) {
        fill: none;
        stroke: #6c757d;
        stroke-width: 1.5px;
        stroke-dasharray: 5 3;
        pointer-events: none;
    }
</style>
