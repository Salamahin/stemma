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
        personColor,
        defaultFamilyColor,
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
        buildGhostInjection,
        ghostSimNeighborDomIds,
        resolveAnchorSimId,
        GHOST_NEIGHBOUR_COLLIDE_R,
        type GhostExtraLink,
        type GhostExtraNode,
    } from "../ghostSim";

    type Props = {
        focusedId: FocusedId | null;
        stemmaIndex: StemmaIndex | null;
        stemmaChartReady: boolean;
        getSimulation: () => any;
        applyManualPositions: () => void;
        onghostClick: (
            kind: GhostKind,
            focused: FocusedId,
            pins: { person: { x: number; y: number }; family: { x: number; y: number } | null },
            existingFamilyId?: string,
        ) => void;
        onpositionsChange: (positions: Array<{ x: number; y: number }>) => void;
    };

    let {
        focusedId,
        stemmaIndex,
        stemmaChartReady,
        getSimulation,
        applyManualPositions,
        onghostClick,
        onpositionsChange,
    }: Props = $props();

    type Pos = { x: number; y: number };

    const SVG_NS = "http://www.w3.org/2000/svg";
    const GHOST_FADE_MS = 200;
    const GHOST_COLOR = "#6c757d";
    const GHOST_ARROW_TO_FAMILY_ID = "v3-ghost-arrow-to-family";
    const GHOST_ARROW_TO_PERSON_ID = "v3-ghost-arrow-to-person";
    /**
     * Springy-bounce profile: one strong energy burst that decays fast.
     * - alpha kicked to 0.6 on focus so charge + collide push hard up front.
     * - alphaTarget 0 (not maintained): the burst dies on its own.
     * - alphaDecay 0.12 → sim reaches alphaMin (0.001) in ~55 ticks (~0.9 s
     *   at 60 fps), then stops.
     * - velocityDecay 0.6 (lighter than the main sim's 0.8) keeps momentum
     *   while the burst lasts so the rebound feels rubbery instead of stiff.
     */
    const GHOST_ALPHA_KICK = 0.6;
    const GHOST_ALPHA_DECAY = 0.12;
    const GHOST_VELOCITY_DECAY = 0.6;

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
        const sim = getSimulation();
        if (!sim) return;

        const focusDomId = normalizeId(focusedId.kind, focusedId.id);
        const focusEl = mainG.querySelector(`#${CSS.escape(focusDomId)}`) as SVGGElement | null;
        const origin = focusEl ? nodeCenter(focusEl) : null;
        if (!origin) return;

        const layout = deriveGhostLayout(focusedId, stemmaIndex);
        if (layout.families.length === 0 && layout.persons.length === 0) return;

        const baseGeneration = (() => {
            if (focusedId.kind === "person") return stemmaIndex.lineage(focusedId.id).generation;
            const fam = stemmaIndex.family(focusedId.id);
            if (!fam) return 0;
            let g = 0;
            for (const pid of fam.parents ?? []) g = Math.max(g, stemmaIndex.lineage(pid).generation);
            return g;
        })();
        const maxGen = Math.max(stemmaIndex.maxGeneration(), 1);
        const ghostPersonColor = (kind: "spouse" | "parent" | "child"): string => {
            const gen = kind === "parent" ? baseGeneration - 1 : kind === "child" ? baseGeneration + 1 : baseGeneration;
            const ratio = Math.min(1, Math.max(0, gen / maxGen));
            return personColor(ratio);
        };

        ensureGhostMarkers(svgEl);
        const labels = $t;
        const allGhostEls: SVGElement[] = [];

        const nodeCenterById = (kind: "person" | "family", id: string): Pos | null => {
            const el = mainG.querySelector(`#${CSS.escape(normalizeId(kind, id))}`) as SVGGElement | null;
            return el ? nodeCenter(el) : null;
        };

        const familyAnchorByRef = new Map<string, Pos>();
        for (const f of layout.families) {
            familyAnchorByRef.set(f.id, { x: origin.x + f.dx, y: origin.y + f.dy });
        }
        if (focusedId.kind === "family") familyAnchorByRef.set(FOCUSED_FAMILY_REF, origin);
        for (const p of layout.persons) {
            if (familyAnchorByRef.has(p.familyId)) continue;
            const realId = realFamilyIdFromRef(p.familyId);
            if (!realId) continue;
            const center = nodeCenterById("family", realId);
            if (center) familyAnchorByRef.set(p.familyId, center);
        }

        const personPositionById = new Map<string, Pos>();
        for (const p of layout.persons) {
            const realRef = p.familyId === FOCUSED_FAMILY_REF || realFamilyIdFromRef(p.familyId) !== null;
            const base = realRef ? familyAnchorByRef.get(p.familyId) ?? origin : origin;
            personPositionById.set(p.id, { x: base.x + p.dx, y: base.y + p.dy });
        }

        const injection = buildGhostInjection(focusedId, layout, {
            origin,
            familyAnchorByRef,
            personPositionById,
        });

        // Capture pre-focus snapshot of every datum currently in the main sim
        // so we can hard-snap real neighbours back on blur and detect ghost
        // datums to filter on cleanup.
        const neighborDomIds = ghostSimNeighborDomIds(focusedId, stemmaIndex);
        const neighbourSnapshots = new Map<string, { x: number; y: number; fx: number | null | undefined; fy: number | null | undefined; r: number | undefined }>();
        const baseNodes = sim.nodes() as Array<any>;
        const baseLinks = (sim.force("link") as d3.ForceLink<any, any>).links() as Array<any>;
        const datumById = new Map<string, any>();
        for (const n of baseNodes) datumById.set(n.id, n);

        // Unfreeze 1-hop neighbours so ghosts can push them via charge/collide.
        // Real datums normally carry no `r`, so the main sim's
        // `radius((d) => d.r * 20)` collide only counts the ghost side. Give
        // each unfrozen neighbour a temporary `r` so the pair-collide pushes
        // properly; restored on cleanup so post-blur edit-mode is unchanged.
        for (const id of neighborDomIds) {
            const d = datumById.get(id);
            if (!d) continue;
            neighbourSnapshots.set(id, { x: d.x, y: d.y, fx: d.fx, fy: d.fy, r: d.r });
            d.fx = null;
            d.fy = null;
            d.r = GHOST_NEIGHBOUR_COLLIDE_R;
        }

        // Append ghost datums to main sim. d3.forceLink re-resolves string
        // source/target via the node-id accessor configured in
        // graphTools.configureSimulation.
        sim.nodes([...baseNodes, ...injection.extraNodes]);
        (sim.force("link") as d3.ForceLink<any, any>).links([...baseLinks, ...injection.extraLinks]);
        const savedVelocityDecay = sim.velocityDecay();
        const savedAlphaDecay = sim.alphaDecay();
        sim.velocityDecay(GHOST_VELOCITY_DECAY);
        sim.alphaDecay(GHOST_ALPHA_DECAY);
        sim.alphaTarget(0).alpha(GHOST_ALPHA_KICK).restart();

        type GhostEdgeRef = {
            line: SVGLineElement;
            sourceId: string;
            targetId: string;
            edgeKind: "focusToFamily" | "familyToPerson";
        };
        const edgeRefs: GhostEdgeRef[] = [];

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
            const ref: GhostEdgeRef = { line, sourceId, targetId, edgeKind };
            edgeRefs.push(ref);
            applyEdgeEndpoints(ref, sourcePos, targetPos);
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
            c.style.fill = defaultFamilyColor;
            g.appendChild(c);
            mainG.appendChild(g);
            allGhostEls.push(g);
            ghostFamilyEls.set(id, g);
        };

        const makeGhostPersonEl = (extra: GhostExtraNode, pos: Pos): void => {
            if (extra.kind == null || extra.labelKey == null || extra.anchorSimId == null) return;
            const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
            g.setAttribute("id", extra.id);
            g.setAttribute("class", "v3-ghost");
            g.setAttribute("transform", `translate(${pos.x},${pos.y})`);
            g.style.opacity = "0";
            const c = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
            c.setAttribute("r", String(personR));
            c.style.fill = ghostPersonColor(extra.kind);
            g.appendChild(c);
            const label = document.createElementNS(SVG_NS, "text") as SVGTextElement;
            label.setAttribute("class", "v3-ghost-label");
            label.setAttribute("dx", String(-personR));
            label.setAttribute("dy", "40");
            label.style.fontSize = labelFontSize;
            label.textContent = labels(extra.labelKey);
            g.appendChild(label);
            mainG.appendChild(g);
            allGhostEls.push(g);
            ghostPersonEls.set(extra.id, g);

            const capturedFocused = focusedId;
            const capturedKind = extra.kind;
            const capturedExistingFamilyId = extra.existingFamilyId;
            const capturedAnchorSimId = extra.anchorSimId;
            g.addEventListener("pointerup", (ev: PointerEvent) => {
                ev.stopPropagation();
                const personNode = ghostNodeById.get(extra.id);
                const famNode = ghostNodeById.get(capturedAnchorSimId) ?? datumById.get(capturedAnchorSimId);
                const personPosNow = personNode ?? pos;
                const famPosNow = famNode ? { x: famNode.x, y: famNode.y } : null;
                onghostClick(capturedKind, capturedFocused, {
                    person: { x: personPosNow.x, y: personPosNow.y },
                    family: famPosNow,
                }, capturedExistingFamilyId);
            });
        };

        const ghostNodeById = new Map<string, GhostExtraNode>();
        for (const n of injection.extraNodes) ghostNodeById.set(n.id, n);

        for (const f of layout.families) {
            const pos = familyAnchorByRef.get(f.id);
            if (pos) makeGhostFamilyEl(f.id, pos);
        }
        for (const extra of injection.extraNodes) {
            if (extra.type !== "ghost-person") continue;
            const pos = personPositionById.get(extra.id);
            if (!pos) continue;
            makeGhostPersonEl(extra, pos);
        }

        for (const a of layout.anchorEdges) {
            const familyPos = familyAnchorByRef.get(a.familyId);
            if (!familyPos) continue;
            if (a.focusedRole === "parent") {
                makeLine(focusDomId, a.familyId, origin, familyPos, "focusToFamily");
            } else {
                makeLine(a.familyId, focusDomId, familyPos, origin, "familyToPerson");
            }
        }
        for (const p of layout.persons) {
            const pos = personPositionById.get(p.id);
            const anchorRef = familyAnchorByRef.get(p.familyId);
            if (!pos || !anchorRef) continue;
            const anchorSimId = resolveAnchorSimId(focusDomId, p.familyId);
            if (p.role === "parent") {
                makeLine(p.id, anchorSimId, pos, anchorRef, "focusToFamily");
            } else {
                makeLine(anchorSimId, p.id, anchorRef, pos, "familyToPerson");
            }
        }

        const emitPositions = () => {
            const live: Pos[] = [];
            for (const n of injection.extraNodes) live.push({ x: n.x, y: n.y });
            onpositionsChange(live);
        };
        emitPositions();

        const resolveEndpoint = (id: string): Pos | null => {
            const ghost = ghostNodeById.get(id);
            if (ghost) return ghost;
            const real = datumById.get(id);
            if (real) return real;
            return null;
        };

        sim.on("tick.v3ghost", () => {
            for (const extra of injection.extraNodes) {
                const el = extra.type === "ghost-family"
                    ? ghostFamilyEls.get(extra.id)
                    : ghostPersonEls.get(extra.id);
                if (el) el.setAttribute("transform", `translate(${extra.x},${extra.y})`);
            }
            for (const e of edgeRefs) {
                const s = resolveEndpoint(e.sourceId);
                const t = resolveEndpoint(e.targetId);
                if (s && t) applyEdgeEndpoints(e, s, t);
            }
        });

        sim.on("end.v3ghost", emitPositions);

        let fadeInCancelled = false;
        requestAnimationFrame(() => {
            if (fadeInCancelled) return;
            for (const el of allGhostEls) el.style.opacity = "";
        });

        return () => {
            fadeInCancelled = true;
            sim.on("tick.v3ghost", null);
            sim.on("end.v3ghost", null);

            // Strip ghost datums out of the main sim arrays.
            const ghostIds = new Set(injection.extraNodes.map((n) => n.id));
            const survivingNodes = (sim.nodes() as Array<any>).filter((n) => !ghostIds.has(n.id));
            const survivingLinks = ((sim.force("link") as d3.ForceLink<any, any>).links() as Array<any>).filter((l) => {
                const src = typeof l.source === "string" ? l.source : (l.source as any).id;
                const tgt = typeof l.target === "string" ? l.target : (l.target as any).id;
                return !ghostIds.has(src) && !ghostIds.has(tgt);
            });
            sim.nodes(survivingNodes);
            (sim.force("link") as d3.ForceLink<any, any>).links(survivingLinks);

            // Hard-snap neighbours back to pre-focus positions and re-pin so
            // edit-mode's "every real node frozen" invariant is restored. The
            // applyManualPositions() call below redraws every real edge from
            // the snapped datum coordinates in one pass.
            for (const [id, snap] of neighbourSnapshots) {
                const d = datumById.get(id);
                if (!d) continue;
                d.x = snap.x;
                d.y = snap.y;
                d.fx = snap.fx == null ? snap.x : snap.fx;
                d.fy = snap.fy == null ? snap.y : snap.fy;
                d.r = snap.r;
            }

            sim.alphaTarget(0).stop();
            sim.velocityDecay(savedVelocityDecay);
            sim.alphaDecay(savedAlphaDecay);
            applyManualPositions();
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
        fill-opacity: 0.25;
        stroke: #6c757d;
        stroke-width: 1.5px;
        stroke-dasharray: 5 3;
        pointer-events: all;
        transition: fill-opacity 150ms ease;
    }

    :global(g.v3-ghost:hover > circle) {
        fill-opacity: 0.85;
    }

    :global(g.v3-ghost:hover) {
        opacity: 1;
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
        fill-opacity: 0.3;
        stroke: #6c757d;
        stroke-width: 1.5px;
        stroke-dasharray: 5 3;
        pointer-events: none;
    }
</style>
