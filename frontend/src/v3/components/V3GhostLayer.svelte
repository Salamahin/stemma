<script lang="ts">
    import * as d3 from "d3";
    import { normalizeId } from "../../graphTools";
    import { personR, familyR, labelFontSize, familyRelationWidth, childRelationWidth, arrowPath } from "../../graphStyles";
    import { t } from "../../i18n";
    import type { StemmaIndex } from "../../stemmaIndex";
    import type { FocusedId } from "../focusGesture";
    import { deriveGhostBranches, immediateNeighborIds, type GhostKind } from "../ghostHelpers";
    import { nodeCenter } from "../v3DomGeometry";
    import { trimToCircle } from "../ghostEdgeGeometry";

    type Props = {
        focusedId: FocusedId | null;
        stemmaIndex: StemmaIndex | null;
        stemmaChartReady: boolean;
        onghostClick: (kind: GhostKind, focused: FocusedId, ghostPos: { x: number; y: number }, existingFamilyId?: string) => void;
        onpositionsChange: (positions: Array<{ x: number; y: number }>) => void;
    };

    let { focusedId, stemmaIndex, stemmaChartReady, onghostClick, onpositionsChange }: Props = $props();

    const SVG_NS = "http://www.w3.org/2000/svg";
    const GHOST_COLOR = "#6c757d";
    const GHOST_ARROW_TO_FAMILY_ID = "v3-ghost-arrow-to-family";
    const GHOST_ARROW_TO_PERSON_ID = "v3-ghost-arrow-to-person";

    function ensureGhostMarkers(svgEl: SVGSVGElement): void {
        if (svgEl.querySelector(`#${GHOST_ARROW_TO_FAMILY_ID}`)) return;
        let defs = svgEl.querySelector("defs");
        if (!defs) {
            defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement;
            svgEl.insertBefore(defs, svgEl.firstChild);
        }
        for (const { id, refX } of [
            { id: GHOST_ARROW_TO_FAMILY_ID, refX: 10 },
            { id: GHOST_ARROW_TO_PERSON_ID, refX: 10 },
        ]) {
            const marker = document.createElementNS(SVG_NS, "marker") as SVGMarkerElement;
            marker.setAttribute("id", id);
            marker.setAttribute("viewBox", "0 0 10 6");
            marker.setAttribute("refX", String(refX));
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

    // Tracks ghost DOM elements that are currently fading out so they can be
    // removed after the CSS transition completes even when a new focus takes
    // over before the 200 ms window is up.
    const GHOST_FADE_MS = 200;
    let fadingOutGhostEls: Element[] = [];

    function fadeOutAndRemove(els: Element[]): void {
        if (els.length === 0) return;
        for (const el of els) {
            (el as HTMLElement | SVGElement).style.opacity = "0";
        }
        fadingOutGhostEls = [...fadingOutGhostEls, ...els];
        setTimeout(() => {
            for (const el of els) {
                el.parentNode?.removeChild(el);
            }
            fadingOutGhostEls = fadingOutGhostEls.filter((e) => !els.includes(e));
        }, GHOST_FADE_MS);
    }

    $effect(() => {
        // Read stemmaChartReady first so Svelte tracks it. Without this, the
        // effect exits early on first mount before the SVG is in the DOM
        // without ever reading focusedId/stemmaIndex, and those deps are never
        // tracked — so a later mousemove that sets focusedId never re-triggers
        // this effect.
        if (!stemmaChartReady) return;
        const svgEl = document.getElementById("chart") as unknown as SVGSVGElement | null;
        const mainG = svgEl?.querySelector("g.main") as SVGGElement | null;
        if (!svgEl || !mainG) return;
        ensureGhostMarkers(svgEl);

        // Snapshot every real node position before any freeze decision.
        type Snapshot = { x: number; y: number };
        const positionSnapshot = new Map<string, Snapshot>();
        d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
            if (d && d.x != null && d.y != null) {
                positionSnapshot.set(d.id, { x: d.x, y: d.y });
            }
        });

        // Immediate neighbors of the focused node participate in the ghost sim
        // unfrozen so ghosts can push them. All other real nodes are frozen.
        // The focused node itself is always frozen.
        const neighborDomIds: Set<string> =
            focusedId && stemmaIndex
                ? new Set(
                      immediateNeighborIds(focusedId, stemmaIndex).map(({ kind, id }) =>
                          normalizeId(kind, id),
                      ),
                  )
                : new Set<string>();

        const focusDomId = focusedId ? normalizeId(focusedId.kind, focusedId.id) : null;

        // Freeze non-neighbor real nodes (including the focused node).
        d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
            if (d && d.x != null && d.y != null) {
                if (!neighborDomIds.has(d.id)) {
                    d.fx = d.x;
                    d.fy = d.y;
                }
            }
        });

        if (!focusedId || !stemmaIndex) return;

        const branches = deriveGhostBranches(focusedId, stemmaIndex);
        if (branches.length === 0) return;

        const focusEl = focusDomId
            ? (mainG.querySelector(`#${CSS.escape(focusDomId)}`) as SVGGElement | null)
            : null;
        const origin = focusEl ? nodeCenter(focusEl) : null;

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

        const realSimNodes: SimNode[] = [];
        const neighborDatumById = new Map<string, any>();
        d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
            if (d && d.x != null && d.y != null) {
                const isNeighbor = neighborDomIds.has(d.id);
                if (isNeighbor) neighborDatumById.set(d.id, d);
                realSimNodes.push({
                    id: d.id,
                    x: d.x,
                    y: d.y,
                    fx: isNeighbor ? null : d.x,
                    fy: isNeighbor ? null : d.y,
                    seedX: d.x,
                    seedY: d.y,
                    isGhost: false,
                });
            }
        });

        const allGhostEls: Element[] = [];

        type EdgeKind = "focusToFamily" | "familyToPerson" | "focusToPerson";

        type BranchSimEntry = {
            familySimNode: SimNode | null;
            personSimNode: SimNode;
            familyEl: SVGGElement | null;
            personEl: SVGGElement;
            edgeFocusToFamily: SVGLineElement | null;
            edgeFamilyToPerson: SVGLineElement | null;
            kind: GhostKind;
            /** Real family sim node for existingFamilyId branches — used to update the edge source in tick. */
            realFamilySimNode: SimNode | null;
        };
        const branchEntries: BranchSimEntry[] = [];

        const makeLine = (x1: number, y1: number, x2: number, y2: number, edgeKind: EdgeKind): SVGLineElement => {
            const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
            line.setAttribute("class", "v3-ghost-edge");
            line.setAttribute("x1", String(x1));
            line.setAttribute("y1", String(y1));
            line.setAttribute("x2", String(x2));
            line.setAttribute("y2", String(y2));
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
            return line;
        };

        const makeGhostFamilyEl = (id: string, x: number, y: number): SVGGElement => {
            const gEl = document.createElementNS(SVG_NS, "g") as SVGGElement;
            gEl.setAttribute("id", id);
            gEl.setAttribute("class", "v3-ghost-family");
            gEl.setAttribute("transform", `translate(${x},${y})`);
            gEl.style.opacity = "0";
            gEl.style.pointerEvents = "none";

            const circle = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
            circle.setAttribute("r", String(familyR));
            gEl.appendChild(circle);

            mainG.appendChild(gEl);
            allGhostEls.push(gEl);
            return gEl;
        };

        const makeGhostPersonEl = (id: string, x: number, y: number, labelKey: string): SVGGElement => {
            const gEl = document.createElementNS(SVG_NS, "g") as SVGGElement;
            gEl.setAttribute("id", id);
            gEl.setAttribute("class", "v3-ghost");
            gEl.setAttribute("transform", `translate(${x},${y})`);
            gEl.style.opacity = "0";

            const circle = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
            circle.setAttribute("r", String(personR));
            gEl.appendChild(circle);

            const labelEl = document.createElementNS(SVG_NS, "text") as SVGTextElement;
            labelEl.setAttribute("class", "v3-ghost-label");
            labelEl.setAttribute("dx", String(-personR));
            labelEl.setAttribute("dy", "40");
            labelEl.style.fontSize = labelFontSize;
            labelEl.textContent = labels(labelKey);
            gEl.appendChild(labelEl);

            mainG.appendChild(gEl);
            allGhostEls.push(gEl);
            return gEl;
        };

        // simNodeById allows building forceLink references to both real and ghost nodes.
        const simNodeById = new Map<string, SimNode>();
        for (const n of realSimNodes) simNodeById.set(n.id, n);

        type SimLink = { source: SimNode; target: SimNode };
        const simLinks: SimLink[] = [];

        for (const branch of branches) {
            const personSeedX = origin ? origin.x + branch.personDx : branch.personDx;
            const personSeedY = origin ? origin.y + branch.personDy : branch.personDy;

            const capturedFocusedId = focusedId;
            const capturedKind = branch.kind;
            const capturedExistingFamilyId = branch.existingFamilyId;

            if (branch.familyId !== null) {
                // Ghost family intermediate node exists.
                const familySeedX = origin ? origin.x + branch.familyDx : branch.familyDx;
                const familySeedY = origin ? origin.y + branch.familyDy : branch.familyDy;

                const edgeFocusToFamily = origin
                    ? makeLine(origin.x, origin.y, familySeedX, familySeedY, "focusToFamily")
                    : null;
                const edgeFamilyToPerson = makeLine(familySeedX, familySeedY, personSeedX, personSeedY, "familyToPerson");

                const familyEl = makeGhostFamilyEl(branch.familyId, familySeedX, familySeedY);
                const personEl = makeGhostPersonEl(branch.personId, personSeedX, personSeedY, branch.labelKey);

                const familySimNode: SimNode = {
                    id: branch.familyId,
                    x: familySeedX,
                    y: familySeedY,
                    seedX: familySeedX,
                    seedY: familySeedY,
                    isGhost: true,
                };
                const personSimNode: SimNode = {
                    id: branch.personId,
                    x: personSeedX,
                    y: personSeedY,
                    seedX: personSeedX,
                    seedY: personSeedY,
                    isGhost: true,
                };
                simNodeById.set(familySimNode.id, familySimNode);
                simNodeById.set(personSimNode.id, personSimNode);

                // Link: focus → ghost family → ghost person.
                const focusSimNode = focusDomId ? simNodeById.get(focusDomId) : null;
                if (focusSimNode) simLinks.push({ source: focusSimNode, target: familySimNode });
                simLinks.push({ source: familySimNode, target: personSimNode });

                branchEntries.push({
                    familySimNode,
                    personSimNode,
                    familyEl,
                    personEl,
                    edgeFocusToFamily,
                    edgeFamilyToPerson,
                    kind: capturedKind,
                    realFamilySimNode: null,
                });

                personEl.addEventListener("pointerup", (e: PointerEvent) => {
                    e.stopPropagation();
                    const ghostPos = { x: personSimNode.x, y: personSimNode.y };
                    onghostClick(capturedKind, capturedFocusedId, ghostPos, capturedExistingFamilyId);
                });
            } else if (branch.existingFamilyId) {
                // Child branch attached to an existing real family (issue #206).
                // The ghost person becomes a sibling — link the real family node to it.
                const realFamilyDomId = normalizeId("family", branch.existingFamilyId);
                const realFamilySimNode = simNodeById.get(realFamilyDomId);
                const realFamilyCenter = realFamilySimNode
                    ? { x: realFamilySimNode.x, y: realFamilySimNode.y }
                    : origin;

                const edgeRealFamilyToPerson = realFamilyCenter
                    ? makeLine(realFamilyCenter.x, realFamilyCenter.y, personSeedX, personSeedY)
                    : null;
                const personEl = makeGhostPersonEl(branch.personId, personSeedX, personSeedY, branch.labelKey);

                const personSimNode: SimNode = {
                    id: branch.personId,
                    x: personSeedX,
                    y: personSeedY,
                    seedX: personSeedX,
                    seedY: personSeedY,
                    isGhost: true,
                };
                simNodeById.set(personSimNode.id, personSimNode);

                // Link the existing real family to the ghost-child so siblings shift.
                if (realFamilySimNode) simLinks.push({ source: realFamilySimNode, target: personSimNode });

                branchEntries.push({
                    familySimNode: null,
                    personSimNode,
                    familyEl: null,
                    personEl,
                    edgeFocusToFamily: edgeRealFamilyToPerson,
                    edgeFamilyToPerson: null,
                    kind: capturedKind,
                    realFamilySimNode: realFamilySimNode ?? null,
                });

                personEl.addEventListener("pointerup", (e: PointerEvent) => {
                    e.stopPropagation();
                    const ghostPos = { x: personSimNode.x, y: personSimNode.y };
                    onghostClick(capturedKind, capturedFocusedId, ghostPos, capturedExistingFamilyId);
                });
            } else {
                // Family-focused child branch (no ghost family, no existing family).
                const edgeFocusToPerson = origin
                    ? makeLine(origin.x, origin.y, personSeedX, personSeedY, "focusToPerson")
                    : null;
                const personEl = makeGhostPersonEl(branch.personId, personSeedX, personSeedY, branch.labelKey);

                const personSimNode: SimNode = {
                    id: branch.personId,
                    x: personSeedX,
                    y: personSeedY,
                    seedX: personSeedX,
                    seedY: personSeedY,
                    isGhost: true,
                };
                simNodeById.set(personSimNode.id, personSimNode);

                // Link: focus → ghost person.
                const focusSimNode = focusDomId ? simNodeById.get(focusDomId) : null;
                if (focusSimNode) simLinks.push({ source: focusSimNode, target: personSimNode });

                branchEntries.push({
                    familySimNode: null,
                    personSimNode,
                    familyEl: null,
                    personEl,
                    edgeFocusToFamily: edgeFocusToPerson,
                    edgeFamilyToPerson: null,
                    kind: capturedKind,
                    realFamilySimNode: null,
                });

                personEl.addEventListener("pointerup", (e: PointerEvent) => {
                    e.stopPropagation();
                    const ghostPos = { x: personSimNode.x, y: personSimNode.y };
                    onghostClick(capturedKind, capturedFocusedId, ghostPos, capturedExistingFamilyId);
                });
            }
        }

        // Trigger fade-in: after the browser has painted the initial opacity:0
        // state, remove the inline style so the CSS rule (opacity: 0.6) applies
        // via the CSS transition.
        let fadeInCancelled = false;
        requestAnimationFrame(() => {
            if (fadeInCancelled) return;
            for (const el of allGhostEls) {
                (el as SVGElement).style.opacity = "";
            }
        });

        const GHOST_RADIUS = 32;
        const LINK_DISTANCE = 85;
        const ghostSimNodes = branchEntries.flatMap((e) =>
            e.familySimNode ? [e.familySimNode, e.personSimNode] : [e.personSimNode],
        );
        const allSimNodes = [...realSimNodes, ...ghostSimNodes];

        const ghostSim = d3
            .forceSimulation<SimNode>(allSimNodes)
            .force("collide", d3.forceCollide<SimNode>().radius(GHOST_RADIUS).strength(0.8))
            .force("seedX", d3.forceX<SimNode>((n) => n.seedX).strength((n) => (n.isGhost ? 0.15 : 0)))
            .force("seedY", d3.forceY<SimNode>((n) => n.seedY).strength((n) => (n.isGhost ? 0.15 : 0)))
            .force(
                "link",
                d3
                    .forceLink<SimNode, SimLink>(simLinks)
                    .distance(LINK_DISTANCE)
                    .strength(0.5),
            )
            .alphaDecay(0.02)
            .velocityDecay(0.6);

        const neighborSimNodeById = new Map<string, SimNode>();
        for (const n of realSimNodes) {
            if (neighborDomIds.has(n.id)) {
                neighborSimNodeById.set(n.id, n);
            }
        }

        let lastPositions: Array<{ x: number; y: number }> = [];
        const positionsEqual = (
            a: Array<{ x: number; y: number }>,
            b: Array<{ x: number; y: number }>,
        ): boolean => {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
            }
            return true;
        };

        ghostSim.on("tick", () => {
            for (const [domId, simNode] of neighborSimNodeById) {
                const gEl = mainG.querySelector(`#${CSS.escape(domId)}`) as SVGGElement | null;
                if (gEl) {
                    gEl.setAttribute("transform", `translate(${simNode.x},${simNode.y})`);
                }
                const datum = neighborDatumById.get(domId);
                if (datum) {
                    datum.x = simNode.x;
                    datum.y = simNode.y;
                }
            }

            const nextPositions: Array<{ x: number; y: number }> = [];
            for (const entry of branchEntries) {
                const { familySimNode, personSimNode, familyEl, personEl, edgeFocusToFamily, edgeFamilyToPerson, realFamilySimNode } = entry;

                personEl.setAttribute("transform", `translate(${personSimNode.x},${personSimNode.y})`);
                nextPositions.push({ x: personSimNode.x, y: personSimNode.y });

                if (familySimNode && familyEl) {
                    familyEl.setAttribute("transform", `translate(${familySimNode.x},${familySimNode.y})`);
                    nextPositions.push({ x: familySimNode.x, y: familySimNode.y });
                    if (edgeFocusToFamily && origin) {
                        const trimmed = trimToCircle(origin.x, origin.y, familySimNode.x, familySimNode.y, familyR);
                        edgeFocusToFamily.setAttribute("x2", String(trimmed.x));
                        edgeFocusToFamily.setAttribute("y2", String(trimmed.y));
                    }
                    if (edgeFamilyToPerson) {
                        const trimmedStart = trimToCircle(personSimNode.x, personSimNode.y, familySimNode.x, familySimNode.y, familyR);
                        const trimmedEnd = trimToCircle(familySimNode.x, familySimNode.y, personSimNode.x, personSimNode.y, personR);
                        edgeFamilyToPerson.setAttribute("x1", String(trimmedStart.x));
                        edgeFamilyToPerson.setAttribute("y1", String(trimmedStart.y));
                        edgeFamilyToPerson.setAttribute("x2", String(trimmedEnd.x));
                        edgeFamilyToPerson.setAttribute("y2", String(trimmedEnd.y));
                    }
                } else if (realFamilySimNode && edgeFocusToFamily) {
                    // Edge from existing real family (may move) to ghost person.
                    edgeFocusToFamily.setAttribute("x1", String(realFamilySimNode.x));
                    edgeFocusToFamily.setAttribute("y1", String(realFamilySimNode.y));
                    edgeFocusToFamily.setAttribute("x2", String(personSimNode.x));
                    edgeFocusToFamily.setAttribute("y2", String(personSimNode.y));
                } else if (edgeFocusToFamily && origin) {
                    const trimmed = trimToCircle(origin.x, origin.y, personSimNode.x, personSimNode.y, personR);
                    edgeFocusToFamily.setAttribute("x2", String(trimmed.x));
                    edgeFocusToFamily.setAttribute("y2", String(trimmed.y));
                }
            }
            if (!positionsEqual(nextPositions, lastPositions)) {
                lastPositions = nextPositions;
                onpositionsChange(nextPositions);
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
        pointer-events: all;
        transition: opacity 200ms ease;
    }

    :global(g.v3-ghost:hover) {
        opacity: 0.9;
    }

    :global(g.v3-ghost > circle) {
        fill: transparent;
        stroke: #6c757d;
        stroke-width: 1.5px;
        stroke-dasharray: 5 3;
    }

    :global(g.v3-ghost:hover > circle) {
        stroke: #0d6efd;
    }

    :global(g.v3-ghost .v3-ghost-label) {
        fill: #6c757d;
    }

    :global(g.v3-ghost:hover .v3-ghost-label) {
        fill: #0d6efd;
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
