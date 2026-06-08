<script lang="ts">
    import { normalizeId } from "../../graphTools";
    import { personR, familyR, labelFontSize, arrowPath } from "../../graphStyles";
    import { t } from "../../i18n";
    import type { StemmaIndex } from "../../stemmaIndex";
    import type { FocusedId } from "../focusGesture";
    import {
        deriveGhostLayout,
        FOCUSED_FAMILY_REF,
        type GhostKind,
    } from "../ghostHelpers";
    import { nodeCenter } from "../v3DomGeometry";

    type Props = {
        focusedId: FocusedId | null;
        stemmaIndex: StemmaIndex | null;
        stemmaChartReady: boolean;
        onghostClick: (kind: GhostKind, focused: FocusedId, ghostPos: { x: number; y: number }) => void;
        onpositionsChange: (positions: Array<{ x: number; y: number }>) => void;
    };

    let { focusedId, stemmaIndex, stemmaChartReady, onghostClick, onpositionsChange }: Props = $props();

    type Pos = { x: number; y: number };

    const SVG_NS = "http://www.w3.org/2000/svg";
    const GHOST_FADE_MS = 200;
    const GHOST_ARROW_FAMILY_ID = "v3-ghost-arrow-family";
    const GHOST_ARROW_PERSON_ID = "v3-ghost-arrow-person";
    const ARROW_FAMILY = `url(#${GHOST_ARROW_FAMILY_ID})`;
    const ARROW_PERSON = `url(#${GHOST_ARROW_PERSON_ID})`;

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

    function ensureGhostArrowMarkers(svgEl: SVGSVGElement): void {
        if (svgEl.querySelector(`marker#${GHOST_ARROW_FAMILY_ID}`)) return;
        let defs = svgEl.querySelector("defs") as SVGDefsElement | null;
        if (!defs) {
            defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement;
            svgEl.insertBefore(defs, svgEl.firstChild);
        }
        const make = (id: string, refX: number) => {
            const m = document.createElementNS(SVG_NS, "marker");
            m.setAttribute("id", id);
            m.setAttribute("viewBox", "0 0 10 6");
            m.setAttribute("refX", String(refX));
            m.setAttribute("refY", "3");
            m.setAttribute("markerWidth", "10");
            m.setAttribute("markerHeight", "6");
            m.setAttribute("markerUnits", "userSpaceOnUse");
            m.setAttribute("orient", "auto");
            m.setAttribute("fill", "#6c757d");
            const p = document.createElementNS(SVG_NS, "path");
            p.setAttribute("d", arrowPath);
            m.appendChild(p);
            defs!.appendChild(m);
        };
        make(GHOST_ARROW_FAMILY_ID, 16);
        make(GHOST_ARROW_PERSON_ID, 26);
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

        ensureGhostArrowMarkers(svgEl);
        const labels = $t;

        const allGhostEls: SVGElement[] = [];

        const makeLine = (s: Pos, t: Pos, markerEnd: string): void => {
            const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
            line.setAttribute("class", "v3-ghost-edge");
            line.setAttribute("x1", String(s.x));
            line.setAttribute("y1", String(s.y));
            line.setAttribute("x2", String(t.x));
            line.setAttribute("y2", String(t.y));
            line.setAttribute("marker-end", markerEnd);
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
                onghostClick(kind, capturedFocused, pos);
            });
        };

        const familyPositions = new Map<string, Pos>();
        for (const f of layout.families) {
            const pos = { x: origin.x + f.dx, y: origin.y + f.dy };
            familyPositions.set(f.id, pos);
            makeGhostFamilyEl(f.id, pos);
        }
        if (focusedId.kind === "family") familyPositions.set(FOCUSED_FAMILY_REF, origin);

        const personPositions = new Map<string, Pos>();
        for (const p of layout.persons) {
            const pos = { x: origin.x + p.dx, y: origin.y + p.dy };
            personPositions.set(p.id, pos);
            makeGhostPersonEl(p.id, pos, p.labelKey, p.kind);
        }

        const addEdge = (source: Pos, target: Pos, pointsTo: "family" | "person") => {
            makeLine(source, target, pointsTo === "family" ? ARROW_FAMILY : ARROW_PERSON);
        };

        for (const a of layout.anchorEdges) {
            const familyPos = familyPositions.get(a.familyId);
            if (!familyPos) continue;
            if (a.focusedRole === "parent") addEdge(origin, familyPos, "family");
            else addEdge(familyPos, origin, "person");
        }

        for (const p of layout.persons) {
            const personPos = personPositions.get(p.id);
            const familyPos = familyPositions.get(p.familyId);
            if (!personPos || !familyPos) continue;
            if (p.role === "parent") addEdge(personPos, familyPos, "family");
            else addEdge(familyPos, personPos, "person");
        }

        let fadeInCancelled = false;
        requestAnimationFrame(() => {
            if (fadeInCancelled) return;
            for (const el of allGhostEls) el.style.opacity = "";
        });

        onpositionsChange([...familyPositions.values(), ...personPositions.values()]);

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
        stroke-width: 1px;
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
