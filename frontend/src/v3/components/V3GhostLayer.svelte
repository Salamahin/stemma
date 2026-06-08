<script lang="ts">
    import * as d3 from "d3";
    import { normalizeId } from "../../graphTools";
    import { personR, familyR, labelFontSize, arrowPath } from "../../graphStyles";
    import { t } from "../../i18n";
    import type { StemmaIndex } from "../../stemmaIndex";
    import type { FocusedId } from "../focusGesture";
    import {
        deriveGhostLayout,
        immediateNeighborIds,
        FOCUSED_FAMILY_REF,
        type GhostKind,
        type GhostPersonPlan,
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

    const SVG_NS = "http://www.w3.org/2000/svg";
    const GHOST_FADE_MS = 200;
    const GHOST_RADIUS = 32;
    const LINK_DISTANCE = 100;
    const GHOST_ARROW_FAMILY_ID = "v3-ghost-arrow-family";
    const GHOST_ARROW_PERSON_ID = "v3-ghost-arrow-person";

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
        // refX matches the corresponding graphStyles markers so the arrow head sits at the node edge.
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
        if (!svgEl || !mainG) return;

        type Snapshot = { x: number; y: number };
        const positionSnapshot = new Map<string, Snapshot>();
        d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
            if (d && d.x != null && d.y != null) positionSnapshot.set(d.id, { x: d.x, y: d.y });
        });

        const neighborDomIds: Set<string> =
            focusedId && stemmaIndex
                ? new Set(
                      immediateNeighborIds(focusedId, stemmaIndex).map(({ kind, id }) =>
                          normalizeId(kind, id),
                      ),
                  )
                : new Set<string>();

        const focusDomId = focusedId ? normalizeId(focusedId.kind, focusedId.id) : null;

        d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
            if (d && d.x != null && d.y != null && !neighborDomIds.has(d.id)) {
                d.fx = d.x;
                d.fy = d.y;
            }
        });

        if (!focusedId || !stemmaIndex) return;

        const layout = deriveGhostLayout(focusedId, stemmaIndex);
        if (layout.families.length === 0 && layout.persons.length === 0) return;

        const focusEl = focusDomId
            ? (mainG.querySelector(`#${CSS.escape(focusDomId)}`) as SVGGElement | null)
            : null;
        const origin = focusEl ? nodeCenter(focusEl) : null;
        if (!origin) return;

        ensureGhostArrowMarkers(svgEl);
        const labels = $t;

        type SimNode = {
            id: string;
            x: number;
            y: number;
            fx?: number | null;
            fy?: number | null;
            seedX: number;
            seedY: number;
            isGhost: boolean;
        };

        type NeighborEntry = { sim: SimNode; el: SVGGElement; datum: any };
        const realSimNodes: SimNode[] = [];
        const neighborEntries = new Map<string, NeighborEntry>();
        d3.select("g.main").selectAll<SVGGElement, any>("g").each(function (this: SVGGElement, d: any) {
            if (!d || d.x == null || d.y == null) return;
            const isNeighbor = neighborDomIds.has(d.id);
            const sim: SimNode = {
                id: d.id,
                x: d.x,
                y: d.y,
                fx: isNeighbor ? null : d.x,
                fy: isNeighbor ? null : d.y,
                seedX: d.x,
                seedY: d.y,
                isGhost: false,
            };
            realSimNodes.push(sim);
            if (isNeighbor) neighborEntries.set(d.id, { sim, el: this, datum: d });
        });
        const realSimNodeById = new Map(realSimNodes.map((n) => [n.id, n]));

        const allGhostEls: SVGElement[] = [];

        const makeLine = (
            x1: number,
            y1: number,
            x2: number,
            y2: number,
            markerEnd: string,
        ): SVGLineElement => {
            const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
            line.setAttribute("class", "v3-ghost-edge");
            line.setAttribute("x1", String(x1));
            line.setAttribute("y1", String(y1));
            line.setAttribute("x2", String(x2));
            line.setAttribute("y2", String(y2));
            line.setAttribute("marker-end", markerEnd);
            line.style.opacity = "0";
            mainG.appendChild(line);
            allGhostEls.push(line);
            return line;
        };

        const makeGhostFamilyEl = (id: string, x: number, y: number): SVGGElement => {
            const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
            g.setAttribute("id", id);
            g.setAttribute("class", "v3-ghost-family");
            g.setAttribute("transform", `translate(${x},${y})`);
            g.style.opacity = "0";
            g.style.pointerEvents = "none";
            const c = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
            c.setAttribute("r", String(familyR));
            g.appendChild(c);
            mainG.appendChild(g);
            allGhostEls.push(g);
            return g;
        };

        const makeGhostPersonEl = (id: string, x: number, y: number, labelKey: string): SVGGElement => {
            const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
            g.setAttribute("id", id);
            g.setAttribute("class", "v3-ghost");
            g.setAttribute("transform", `translate(${x},${y})`);
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
            return g;
        };

        type Pos = { x: number; y: number };
        type FamilyAnchor = { simNode: SimNode | null; el: SVGGElement | null; getPos: () => Pos };
        const familyAnchors = new Map<string, FamilyAnchor>();

        for (const f of layout.families) {
            const fx = origin.x + f.dx;
            const fy = origin.y + f.dy;
            const el = makeGhostFamilyEl(f.id, fx, fy);
            const sim: SimNode = { id: f.id, x: fx, y: fy, seedX: fx, seedY: fy, isGhost: true };
            familyAnchors.set(f.id, { simNode: sim, el, getPos: () => ({ x: sim.x, y: sim.y }) });
        }
        // Focused real family acts as the anchor for a child-ghost in focused-family case.
        if (focusedId.kind === "family") {
            const focusSim = focusDomId ? realSimNodeById.get(focusDomId) : null;
            familyAnchors.set(FOCUSED_FAMILY_REF, {
                simNode: null,
                el: null,
                getPos: () => (focusSim ? { x: focusSim.x, y: focusSim.y } : origin),
            });
        }

        type PersonEntry = { plan: GhostPersonPlan; sim: SimNode; el: SVGGElement };
        const personEntries: PersonEntry[] = [];

        for (const p of layout.persons) {
            const px = origin.x + p.dx;
            const py = origin.y + p.dy;
            const el = makeGhostPersonEl(p.id, px, py, p.labelKey);
            const sim: SimNode = { id: p.id, x: px, y: py, seedX: px, seedY: py, isGhost: true };
            personEntries.push({ plan: p, sim, el });
            const capturedKind = p.kind;
            const capturedFocused = focusedId;
            el.addEventListener("pointerup", (ev: PointerEvent) => {
                ev.stopPropagation();
                onghostClick(capturedKind, capturedFocused, { x: sim.x, y: sim.y });
            });
        }

        type EdgeEntry = { line: SVGLineElement; getA: () => Pos; getB: () => Pos };
        const edges: EdgeEntry[] = [];

        const focusPos = (): Pos => {
            const sim = focusDomId ? realSimNodeById.get(focusDomId) : null;
            return sim ? { x: sim.x, y: sim.y } : origin;
        };
        const ARROW_FAMILY = `url(#${GHOST_ARROW_FAMILY_ID})`;
        const ARROW_PERSON = `url(#${GHOST_ARROW_PERSON_ID})`;

        const addEdge = (source: () => Pos, target: () => Pos, pointsTo: "family" | "person"): void => {
            const s = source();
            const t = target();
            const line = makeLine(s.x, s.y, t.x, t.y, pointsTo === "family" ? ARROW_FAMILY : ARROW_PERSON);
            edges.push({ line, getA: source, getB: target });
        };

        for (const a of layout.anchorEdges) {
            const anchor = familyAnchors.get(a.familyId);
            if (!anchor) continue;
            if (a.focusedRole === "parent") addEdge(focusPos, anchor.getPos, "family");
            else addEdge(anchor.getPos, focusPos, "person");
        }

        for (const e of personEntries) {
            const anchor = familyAnchors.get(e.plan.familyId);
            if (!anchor) continue;
            const personPos = () => ({ x: e.sim.x, y: e.sim.y });
            if (e.plan.role === "parent") addEdge(personPos, anchor.getPos, "family");
            else addEdge(anchor.getPos, personPos, "person");
        }

        let fadeInCancelled = false;
        requestAnimationFrame(() => {
            if (fadeInCancelled) return;
            for (const el of allGhostEls) el.style.opacity = "";
        });

        const ghostSimNodes: SimNode[] = [
            ...[...familyAnchors.values()].map((a) => a.simNode).filter((n): n is SimNode => n !== null),
            ...personEntries.map((p) => p.sim),
        ];
        const allSimNodes: SimNode[] = [...realSimNodes, ...ghostSimNodes];

        // Link force keeps ghosts attached to their family at LINK_DISTANCE.
        type Link = { source: string; target: string };
        const links: Link[] = [];
        for (const a of layout.anchorEdges) {
            if (focusDomId) links.push({ source: focusDomId, target: a.familyId });
        }
        for (const p of layout.persons) {
            const familyId = p.familyId === FOCUSED_FAMILY_REF ? focusDomId : p.familyId;
            if (familyId) links.push({ source: familyId, target: p.id });
        }

        const ghostSim = d3
            .forceSimulation<SimNode>(allSimNodes)
            .force("collide", d3.forceCollide<SimNode>().radius(GHOST_RADIUS).strength(0.9))
            .force(
                "link",
                d3
                    .forceLink<SimNode, Link>(links)
                    .id((n) => n.id)
                    .distance(LINK_DISTANCE)
                    .strength(0.6),
            )
            .force("seedX", d3.forceX<SimNode>((n) => n.seedX).strength((n) => (n.isGhost ? 0.05 : 0)))
            .force("seedY", d3.forceY<SimNode>((n) => n.seedY).strength((n) => (n.isGhost ? 0.05 : 0)))
            .alphaDecay(0.02)
            .velocityDecay(0.6);

        let lastPositions: Pos[] = [];
        const positionsEqual = (a: Pos[], b: Pos[]): boolean => {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
            }
            return true;
        };

        ghostSim.on("tick", () => {
            for (const { sim, el, datum } of neighborEntries.values()) {
                el.setAttribute("transform", `translate(${sim.x},${sim.y})`);
                datum.x = sim.x;
                datum.y = sim.y;
            }

            const next: Pos[] = [];
            for (const anchor of familyAnchors.values()) {
                if (!anchor.simNode || !anchor.el) continue;
                anchor.el.setAttribute("transform", `translate(${anchor.simNode.x},${anchor.simNode.y})`);
                next.push({ x: anchor.simNode.x, y: anchor.simNode.y });
            }
            for (const e of personEntries) {
                e.el.setAttribute("transform", `translate(${e.sim.x},${e.sim.y})`);
                next.push({ x: e.sim.x, y: e.sim.y });
            }
            for (const edge of edges) {
                const a = edge.getA();
                const b = edge.getB();
                edge.line.setAttribute("x1", String(a.x));
                edge.line.setAttribute("y1", String(a.y));
                edge.line.setAttribute("x2", String(b.x));
                edge.line.setAttribute("y2", String(b.y));
            }

            if (!positionsEqual(next, lastPositions)) {
                lastPositions = next;
                onpositionsChange(next);
            }
        });

        return () => {
            fadeInCancelled = true;
            ghostSim.stop();
            onpositionsChange([]);
            fadeOutAndRemove(allGhostEls);

            // Hard-snap synchronously: a deferred snap-back would let the next
            // focus snapshot stale mid-animation coordinates.
            d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
                if (!d) return;
                const snap = positionSnapshot.get(d.id);
                if (neighborDomIds.has(d.id) && snap) {
                    d.x = snap.x;
                    d.y = snap.y;
                    d.fx = null;
                    d.fy = null;
                    const gEl = mainG.querySelector(`#${CSS.escape(d.id)}`) as SVGGElement | null;
                    if (gEl) gEl.setAttribute("transform", `translate(${snap.x},${snap.y})`);
                } else {
                    d.fx = null;
                    d.fy = null;
                }
            });
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
