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
        realFamilyIdFromRef,
        type GhostKind,
    } from "../ghostHelpers";
    import { nodeCenter } from "../v3DomGeometry";
    import { trimToCircle, GHOST_EDGE_GAP } from "../ghostEdgeGeometry";
    import {
        buildGhostSimGraph,
        configureGhostSim,
        ghostSimNeighborDomIds,
    } from "../ghostSim";

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

        // Seed positions for ghost nodes. Families derive from their declared
        // offset relative to either the focused node or an existing family.
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

        type GhostEdgeRef = {
            line: SVGLineElement;
            sourceId: string;
            targetId: string;
            edgeKind: "focusToFamily" | "familyToPerson";
        };
        const edgeRefs: GhostEdgeRef[] = [];

        const makeLine = (
            sourceId: string,
            targetId: string,
            sourcePos: Pos,
            targetPos: Pos,
            edgeKind: "focusToFamily" | "familyToPerson",
        ): void => {
            const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
            line.setAttribute("class", "v3-ghost-edge");
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
            edgeRefs.push({ line, sourceId, targetId, edgeKind });
            applyEdgeEndpoints(edgeRefs[edgeRefs.length - 1], sourcePos, targetPos);
        };

        const applyEdgeEndpoints = (ref: GhostEdgeRef, source: Pos, target: Pos): void => {
            const sourceR = ref.edgeKind === "focusToFamily" ? personR : familyR;
            const targetR = ref.edgeKind === "focusToFamily" ? familyR : personR;
            const tip = trimToCircle(source.x, source.y, target.x, target.y, targetR + GHOST_EDGE_GAP);
            const tail = trimToCircle(target.x, target.y, source.x, source.y, sourceR + GHOST_EDGE_GAP);
            ref.line.setAttribute("x1", String(tail.x));
            ref.line.setAttribute("y1", String(tail.y));
            ref.line.setAttribute("x2", String(tip.x));
            ref.line.setAttribute("y2", String(tip.y));
        };

        const ghostFamilyEls = new Map<string, SVGGElement>();
        const ghostPersonEls = new Map<string, SVGGElement>();

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
            ghostFamilyEls.set(id, g);
        };

        const makeGhostPersonEl = (
            id: string,
            pos: Pos,
            labelKey: string,
            kind: GhostKind,
            existingFamilyId: string | undefined,
            familyId: string,
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
            ghostPersonEls.set(id, g);

            const capturedFocused = focusedId;
            g.addEventListener("pointerup", (ev: PointerEvent) => {
                ev.stopPropagation();
                const personPosNow = positionsById.get(id) ?? pos;
                const famPosNow = positionsById.get(familyId) ?? null;
                onghostClick(kind, capturedFocused, {
                    person: { x: personPosNow.x, y: personPosNow.y },
                    family: famPosNow,
                }, existingFamilyId);
            });
        };

        // Render ghost DOM elements at seed positions.
        for (const f of layout.families) {
            const pos = familyAnchor.get(f.id);
            if (pos) makeGhostFamilyEl(f.id, pos);
        }
        for (const p of layout.persons) {
            const pos = personPos.get(p.id);
            if (!pos) continue;
            const existingFamilyId = realFamilyIdFromRef(p.familyId) ?? undefined;
            const ghostFamilyId = p.familyId === FOCUSED_FAMILY_REF
                ? focusDomId
                : (realFamilyIdFromRef(p.familyId) ? normalizeId("family", realFamilyIdFromRef(p.familyId)!) : p.familyId);
            makeGhostPersonEl(p.id, pos, p.labelKey, p.kind, existingFamilyId, ghostFamilyId);
        }

        // Ghost edges — anchor edges link focused ↔ ghost-family; person edges
        // link each ghost person to its anchor family (ghost or real).
        for (const a of layout.anchorEdges) {
            const familyPos = familyAnchor.get(a.familyId);
            if (!familyPos) continue;
            if (a.focusedRole === "parent") {
                makeLine(focusDomId, a.familyId, origin, familyPos, "focusToFamily");
            } else {
                makeLine(a.familyId, focusDomId, familyPos, origin, "familyToPerson");
            }
        }
        for (const p of layout.persons) {
            const pos = personPos.get(p.id);
            const anchorPos = familyAnchor.get(p.familyId);
            if (!pos || !anchorPos) continue;
            const anchorSimId = p.familyId === FOCUSED_FAMILY_REF
                ? focusDomId
                : (realFamilyIdFromRef(p.familyId) ? normalizeId("family", realFamilyIdFromRef(p.familyId)!) : p.familyId);
            if (p.role === "parent") {
                makeLine(p.id, anchorSimId, pos, anchorPos, "focusToFamily");
            } else {
                makeLine(anchorSimId, p.id, anchorPos, pos, "familyToPerson");
            }
        }

        // Set up sim. Real neighbours participate; non-neighbours stay pinned
        // at their current positions and are excluded from the sim.
        const neighborDomIds = ghostSimNeighborDomIds(focusedId, stemmaIndex);
        const positionSnapshot = new Map<string, Pos>();
        const neighborEls = new Map<string, SVGGElement>();
        const neighborDatums = new Map<string, any>();
        const neighborPositions = new Map<string, Pos>();

        d3.select("g.main").selectAll<SVGGElement, any>("g").each(function (this: SVGGElement, d: any) {
            if (!d || d.x == null || d.y == null) return;
            positionSnapshot.set(d.id, { x: d.x, y: d.y });
            if (neighborDomIds.has(d.id)) {
                neighborEls.set(d.id, this);
                neighborDatums.set(d.id, d);
                neighborPositions.set(d.id, { x: d.x, y: d.y });
            }
        });

        const ghostSeedPositions = new Map<string, Pos>();
        for (const f of layout.families) {
            const pos = familyAnchor.get(f.id);
            if (pos) ghostSeedPositions.set(f.id, pos);
        }
        for (const p of layout.persons) {
            const pos = personPos.get(p.id);
            if (pos) ghostSeedPositions.set(p.id, pos);
        }

        const graph = buildGhostSimGraph(focusedId, stemmaIndex, layout, {
            origin,
            neighborPositions,
            ghostPositions: ghostSeedPositions,
        });
        const sim = configureGhostSim(graph, origin);

        // Live position map shared with ghost-click handler and the focus
        // controller hover-detection callback.
        const positionsById = new Map<string, Pos>();
        for (const n of graph.nodes) positionsById.set(n.id, { x: n.x, y: n.y });

        const emitPositions = () => {
            const live: Pos[] = [];
            for (const n of graph.nodes) {
                if (!n.isGhost) continue;
                live.push({ x: n.x, y: n.y });
            }
            onpositionsChange(live);
        };

        emitPositions();

        sim.on("tick", () => {
            for (const n of graph.nodes) {
                positionsById.set(n.id, { x: n.x, y: n.y });
                if (n.isGhost) {
                    const fEl = ghostFamilyEls.get(n.id);
                    if (fEl) fEl.setAttribute("transform", `translate(${n.x},${n.y})`);
                    const pEl = ghostPersonEls.get(n.id);
                    if (pEl) pEl.setAttribute("transform", `translate(${n.x},${n.y})`);
                } else {
                    const el = neighborEls.get(n.id);
                    if (!el) continue;
                    el.setAttribute("transform", `translate(${n.x},${n.y})`);
                    const d = neighborDatums.get(n.id);
                    if (d) {
                        d.x = n.x;
                        d.y = n.y;
                    }
                }
            }
            for (const e of edgeRefs) {
                const s = positionsById.get(e.sourceId);
                const t = positionsById.get(e.targetId);
                if (s && t) applyEdgeEndpoints(e, s, t);
            }
            emitPositions();
        });

        let fadeInCancelled = false;
        requestAnimationFrame(() => {
            if (fadeInCancelled) return;
            for (const el of allGhostEls) el.style.opacity = "";
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
            for (const [id, el] of neighborEls) {
                const snap = positionSnapshot.get(id);
                if (!snap) continue;
                const d = neighborDatums.get(id);
                if (d) {
                    d.x = snap.x;
                    d.y = snap.y;
                }
                el.setAttribute("transform", `translate(${snap.x},${snap.y})`);
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
