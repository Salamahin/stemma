<script lang="ts">
    import * as d3 from "d3";
    import { normalizeId } from "../graphTools";
    import { applyLayoutForces } from "../layoutCore";
    import { personColor } from "../graphStyles";
    import { t } from "../i18n";
    import type { StemmaIndex } from "../stemmaIndex";
    import type { FocusedId } from "../focusGesture";
    import {
        deriveGhostLayout,
        FOCUSED_FAMILY_REF,
        realFamilyIdFromRef,
        type GhostKind,
    } from "../ghostHelpers";
    import { NeighbourPush, pushRegistryFor, type Segment } from "../ghostPush";
    import {
        buildGhostInjection,
        ghostSimNeighborDomIds,
        resolveAnchorSimId,
        GHOST_NEIGHBOUR_COLLIDE_R,
        type GhostExtraNode,
    } from "../ghostSim";
    import type { CanvasChart, GhostEdgeView, GhostNodeView } from "../canvasChart";

    type Props = {
        focusedId: FocusedId | null;
        stemmaIndex: StemmaIndex | null;
        chart: CanvasChart | null;
        /** Where the main layout's centring forces pull (same forces here). */
        getLayoutCenter: () => [number, number];
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
        chart,
        getLayoutCenter,
        onghostClick,
        onpositionsChange,
    }: Props = $props();

    type Pos = { x: number; y: number };

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

    // The glide that takes pushed neighbours home after a blur (see ghostPush.ts).
    let returnFrame: number | null = null;
    function glideHome(c: CanvasChart) {
        if (returnFrame != null) return;
        const registry = pushRegistryFor(c);
        const frame = () => {
            returnFrame = null;
            if (registry.returnStep()) c.positionsChanged();
            if (registry.returning()) returnFrame = requestAnimationFrame(frame);
        };
        returnFrame = requestAnimationFrame(frame);
    }
    $effect(() => {
        const c = chart;
        return () => {
            // chart replaced or gone: everyone home at once
            if (returnFrame != null) cancelAnimationFrame(returnFrame);
            returnFrame = null;
            if (c && pushRegistryFor(c).settle()) c.positionsChanged();
        };
    });

    $effect(() => {
        if (!chart || !focusedId || !stemmaIndex) return;
        const c = chart;

        const focusDomId = normalizeId(focusedId.kind, focusedId.id);
        const focusNode = c.node(focusDomId);
        const origin: Pos | null = focusNode ? { x: focusNode.x, y: focusNode.y } : null;
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

        const labels = $t;

        const nodeCenterById = (kind: "person" | "family", id: string): Pos | null => {
            const n = c.node(normalizeId(kind, id));
            return n ? { x: n.x, y: n.y } : null;
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

        // The ghost burst runs on the main thread in its own simulation: it is
        // short (~55 ticks), interactive (focus, hover and ghost clicks need the
        // positions synchronously) and every real node is frozen during it, so
        // it shares nothing with the (worker) layout, which is stopped in edit
        // mode anyway. Real nodes join as frozen copies, with all real links,
        // so charge/collide/link (incl. d3's degree-based link bias) act on the
        // ghosts exactly as when they were injected into the main simulation.
        const neighborDomIds = ghostSimNeighborDomIds(focusedId, stemmaIndex);
        const datumById = new Map<string, any>();
        const realCopies = c.nodes.map((n) => {
            const copy: any = { id: n.id, type: n.type, x: n.x, y: n.y, fx: n.x, fy: n.y, vx: 0, vy: 0 };
            datumById.set(n.id, copy);
            return copy;
        });
        const realLinks = c.links
            .filter((l) => typeof l.source === "object" && typeof l.target === "object")
            .map((l) => ({ source: (l.source as any).id as string, target: (l.target as any).id as string }));

        // Real neighbours (and the focused node) get a collide radius so the
        // collide force — which only sees datums with an `r` — keeps ghosts off
        // them. Frozen + sized = ghosts get pushed around a rigid real graph.
        for (const id of neighborDomIds) {
            const d = datumById.get(id);
            if (d) d.r = GHOST_NEIGHBOUR_COLLIDE_R;
        }
        const focusedDatum = datumById.get(focusDomId);
        if (focusedDatum) focusedDatum.r = GHOST_NEIGHBOUR_COLLIDE_R;

        // Real nodes around the ghosts make room for them while they are shown
        // (moved on the chart itself, glide back on blur; see ghostPush.ts),
        // and the ghosts keep off them in turn, so both give way.
        const push = new NeighbourPush(c.nodes, c.links, datumById, focusDomId, injection.extraNodes, pushRegistryFor(c), (n) => c.isPinned(n));
        for (const id of push.pushedIds) {
            const d = datumById.get(id);
            if (d && d.r == null) d.r = GHOST_NEIGHBOUR_COLLIDE_R;
        }

        // Pin ghost y to the seed value: the schema (spouse east of focus at
        // same y, child below east family, parent above) is the affordance
        // semantic and must not drift under the sim's forceY/link pull. Ghosts
        // stay springy along x — collide + repel still push them rightward off
        // the focus and away from neighbours.
        // ghost-family is an invisible-ish anchor for spouse/child edges; pin
        // both axes so it stays at its seed and the arrows do not drift.
        for (const extra of injection.extraNodes) {
            (extra as any).fy = extra.y;
            if (extra.type === "ghost-family") (extra as any).fx = extra.x;
        }

        const [cx, cy] = getLayoutCenter();
        const sim = d3.forceSimulation([...realCopies, ...injection.extraNodes] as any[]).stop();
        applyLayoutForces(sim, [...realLinks, ...injection.extraLinks] as any[], cx * 2, cy * 2);
        sim.velocityDecay(GHOST_VELOCITY_DECAY);
        sim.alphaDecay(GHOST_ALPHA_DECAY);
        sim.alphaTarget(0).alpha(GHOST_ALPHA_KICK).restart();

        // The ghost datums double as the renderer's view objects: the sim
        // moves them, the canvas reads their live x/y every frame.
        const ghostNodeById = new Map<string, GhostExtraNode>();
        for (const n of injection.extraNodes) ghostNodeById.set(n.id, n);

        const views: GhostNodeView[] = [];
        for (const f of layout.families) {
            const extra = ghostNodeById.get(f.id);
            if (extra && familyAnchorByRef.has(f.id)) views.push(extra as GhostNodeView);
        }
        for (const extra of injection.extraNodes) {
            if (extra.type !== "ghost-person") continue;
            if (!personPositionById.has(extra.id)) continue;
            if (extra.kind == null || extra.labelKey == null || extra.anchorSimId == null) continue;
            const view = extra as GhostExtraNode & GhostNodeView;
            view.color = ghostPersonColor(extra.kind);
            view.label = labels(extra.labelKey);
            views.push(view);
        }

        const edges: GhostEdgeView[] = [];
        for (const a of layout.anchorEdges) {
            if (!familyAnchorByRef.has(a.familyId)) continue;
            if (a.focusedRole === "parent") {
                edges.push({ sourceId: focusDomId, targetId: a.familyId, edgeKind: "focusToFamily" });
            } else {
                edges.push({ sourceId: a.familyId, targetId: focusDomId, edgeKind: "familyToPerson" });
            }
        }
        for (const p of layout.persons) {
            if (!personPositionById.has(p.id) || !familyAnchorByRef.has(p.familyId)) continue;
            const anchorSimId = resolveAnchorSimId(focusDomId, p.familyId);
            if (p.role === "parent") {
                edges.push({ sourceId: p.id, targetId: anchorSimId, edgeKind: "focusToFamily" });
            } else {
                edges.push({ sourceId: anchorSimId, targetId: p.id, edgeKind: "familyToPerson" });
            }
        }

        const hideGhosts = c.showGhosts({ nodes: views, edges });

        // dashed ghost edges, as live endpoints, so people get off them too
        const ghostSegments: Segment[] = [];
        for (const e of edges) {
            const a = ghostNodeById.get(e.sourceId) ?? c.node(e.sourceId);
            const b = ghostNodeById.get(e.targetId) ?? c.node(e.targetId);
            if (a && b) ghostSegments.push([a, b]);
        }

        const capturedFocused = focusedId;
        // Ghost click: pointerup over a ghost person. Stopping propagation keeps
        // the window-level gesture handler from treating it as a canvas tap.
        const onPointerUp = (ev: PointerEvent) => {
            const hit = c.hitGhost(ev.clientX, ev.clientY);
            if (!hit) return;
            const extra = ghostNodeById.get(hit.id);
            if (!extra || extra.kind == null || extra.anchorSimId == null) return;
            ev.stopPropagation();
            const famNode = ghostNodeById.get(extra.anchorSimId) ?? datumById.get(extra.anchorSimId);
            const famPosNow = famNode ? { x: famNode.x, y: famNode.y } : null;
            onghostClick(extra.kind, capturedFocused, {
                person: { x: extra.x, y: extra.y },
                family: famPosNow,
            }, extra.existingFamilyId);
        };
        c.canvas.addEventListener("pointerup", onPointerUp);

        const emitPositions = () => {
            const live: Pos[] = [];
            for (const n of injection.extraNodes) live.push({ x: n.x, y: n.y });
            onpositionsChange(live);
        };
        emitPositions();

        sim.on("tick.ghost", () => {
            if (push.step(injection.extraNodes, ghostSegments)) c.positionsChanged();
            else c.requestRender();
        });
        sim.on("end.ghost", emitPositions);

        return () => {
            c.canvas.removeEventListener("pointerup", onPointerUp);
            sim.on("tick.ghost", null);
            sim.on("end.ghost", null);
            sim.stop();
            push.release();
            glideHome(c);
            onpositionsChange([]);
            hideGhosts();
        };
    });
</script>

