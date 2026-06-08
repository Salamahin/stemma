<script lang="ts">
    import * as d3 from "d3";
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
        immediateNeighborIds,
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
            pins: { person: { x: number; y: number }; family: { x: number; y: number } | null },
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
    const GHOST_COLLIDE_RADIUS = 36;

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

        const nodeCenterById = (kind: "person" | "family", id: string): Pos | null => {
            const el = mainG.querySelector(`#${CSS.escape(normalizeId(kind, id))}`) as SVGGElement | null;
            return el ? nodeCenter(el) : null;
        };

        const familyAnchor = new Map<string, Pos>();
        for (const f of layout.families) {
            familyAnchor.set(f.id, { x: origin.x + f.dx, y: origin.y + f.dy });
        }
        if (focusedId.kind === "family") familyAnchor.set(FOCUSED_FAMILY_REF, origin);
        for (const p of layout.persons) {
            if (familyAnchor.has(p.familyId)) continue;
            const realId = realFamilyIdFromRef(p.familyId);
            if (!realId) continue;
            const center = nodeCenterById("family", realId);
            if (center) familyAnchor.set(p.familyId, center);
        }

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
        ): void => {
            const sourceRadius = edgeKind === "focusToFamily" ? personR : familyR;
            const targetRadius = edgeKind === "focusToFamily" ? familyR : personR;
            const tip = trimToCircle(source.x, source.y, target.x, target.y, targetRadius);
            const tail = trimToCircle(target.x, target.y, source.x, source.y, sourceRadius);
            const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
            line.setAttribute("class", "v3-ghost-edge");
            line.setAttribute("x1", String(tail.x));
            line.setAttribute("y1", String(tail.y));
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
            familyPos: Pos | null,
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
                onghostClick(kind, capturedFocused, { person: pos, family: familyPos }, existingFamilyId);
            });
        };

        for (const f of layout.families) {
            const pos = familyAnchor.get(f.id);
            if (pos) makeGhostFamilyEl(f.id, pos);
        }
        for (const p of layout.persons) {
            const pos = personPos.get(p.id);
            if (!pos) continue;
            const existingFamilyId = realFamilyIdFromRef(p.familyId) ?? undefined;
            const famPos = familyAnchor.get(p.familyId) ?? null;
            makeGhostPersonEl(p.id, pos, p.labelKey, p.kind, existingFamilyId, famPos);
        }

        for (const a of layout.anchorEdges) {
            const familyPos = familyAnchor.get(a.familyId);
            if (!familyPos) continue;
            if (a.focusedRole === "parent") {
                makeLine(origin, familyPos, "focusToFamily");
            } else {
                makeLine(familyPos, origin, "familyToPerson");
            }
        }

        for (const p of layout.persons) {
            const pos = personPos.get(p.id);
            const anchorPos = familyAnchor.get(p.familyId);
            if (!pos || !anchorPos) continue;
            if (p.role === "parent") {
                makeLine(pos, anchorPos, "focusToFamily");
            } else {
                makeLine(anchorPos, pos, "familyToPerson");
            }
        }

        let fadeInCancelled = false;
        requestAnimationFrame(() => {
            if (fadeInCancelled) return;
            for (const el of allGhostEls) el.style.opacity = "";
        });

        onpositionsChange([...familyAnchor.values(), ...personPos.values()]);

        // One-way physics: ghosts are frozen at their planned positions but
        // their collision circles push 1-hop real neighbours aside so existing
        // nodes don't sit on top of the affordances. Real non-neighbour nodes
        // stay pinned at their current positions.
        type SimNode = {
            id: string;
            x: number;
            y: number;
            fx?: number | null;
            fy?: number | null;
            isGhost: boolean;
            el?: SVGGElement | null;
            datum?: any;
        };

        const neighborDomIds = new Set(
            immediateNeighborIds(focusedId, stemmaIndex).map((n) => normalizeId(n.kind, n.id)),
        );
        const positionSnapshot = new Map<string, { x: number; y: number }>();
        const simNodes: SimNode[] = [];
        const neighborSims: SimNode[] = [];

        d3.select("g.main").selectAll<SVGGElement, any>("g").each(function (this: SVGGElement, d: any) {
            if (!d || d.x == null || d.y == null) return;
            positionSnapshot.set(d.id, { x: d.x, y: d.y });
            const isNeighbor = neighborDomIds.has(d.id);
            const sim: SimNode = {
                id: d.id,
                x: d.x,
                y: d.y,
                fx: isNeighbor ? null : d.x,
                fy: isNeighbor ? null : d.y,
                isGhost: false,
                el: this,
                datum: d,
            };
            simNodes.push(sim);
            if (isNeighbor) neighborSims.push(sim);
        });

        // Ghost sim nodes: frozen at the static plan positions.
        for (const f of layout.families) {
            const pos = familyAnchor.get(f.id);
            if (!pos) continue;
            simNodes.push({ id: f.id, x: pos.x, y: pos.y, fx: pos.x, fy: pos.y, isGhost: true });
        }
        for (const p of layout.persons) {
            const pos = personPos.get(p.id);
            if (!pos) continue;
            simNodes.push({ id: p.id, x: pos.x, y: pos.y, fx: pos.x, fy: pos.y, isGhost: true });
        }

        const sim = d3
            .forceSimulation<SimNode>(simNodes)
            .force("collide", d3.forceCollide<SimNode>().radius(GHOST_COLLIDE_RADIUS).strength(0.9))
            .alphaDecay(0.04)
            .velocityDecay(0.5);

        sim.on("tick", () => {
            for (const n of neighborSims) {
                if (!n.el) continue;
                n.el.setAttribute("transform", `translate(${n.x},${n.y})`);
                if (n.datum) {
                    n.datum.x = n.x;
                    n.datum.y = n.y;
                }
            }
        });

        return () => {
            fadeInCancelled = true;
            sim.stop();
            onpositionsChange([]);
            fadeOutAndRemove(allGhostEls);

            // Hard-snap neighbours back to their pre-focus positions
            // synchronously so the next focus snapshot doesn't pick up
            // mid-physics coordinates. Datum fx/fy is left as FullStemma set
            // it — edit mode keeps every real node pinned anyway.
            for (const n of neighborSims) {
                const snap = positionSnapshot.get(n.id);
                if (!snap) continue;
                if (n.datum) {
                    n.datum.x = snap.x;
                    n.datum.y = snap.y;
                }
                if (n.el) n.el.setAttribute("transform", `translate(${snap.x},${snap.y})`);
            }
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
