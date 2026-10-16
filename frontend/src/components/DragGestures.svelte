<script lang="ts">
    import { denormalizeId } from "../graphTools";
    import { t } from "../i18n";
    import type { StemmaIndex } from "../stemmaIndex";
    import { focusedIdFromNodeId, isShortTap, TAP_MAX_MS, TAP_MAX_MOVE_PX, type FocusedId } from "../focusGesture";
    import {
        isPendingFamilyId,
        isPendingId,
        isPendingPersonId,
        type FamilyRole,
        type PendingFamily,
    } from "../pendingState";
    import type { CanvasChart, ChartNode, DropClass } from "../canvasChart";

    type NodeRef = { kind: "person" | "family"; id: string };
    type NodeHit = { ref: NodeRef; node: ChartNode };

    type SourceRef = { kind: "person"; id: string } | { kind: "family"; id: string } | { kind: "empty" };

    type Props = {
        editMode: boolean;
        panActive: boolean;
        panMode: boolean;
        chart: CanvasChart | null;
        displayedStemmaIndex: StemmaIndex | null;
        findPendingFamily: (id: string) => PendingFamily | undefined;
        popHover: () => void;
        onattachPersonToFamily: (
            personId: string,
            familyId: string,
            role: FamilyRole,
            pinAt?: { x: number; y: number },
        ) => void;
        oncreatePersonInFamily: (
            familyId: string,
            role: FamilyRole,
            title: string,
            pinAt?: { x: number; y: number },
        ) => void;
        oncreatePendingFamily: (
            personId: string,
            role: FamilyRole,
            familyAt: { x: number; y: number },
        ) => void;
        onshortTapFocus: (f: FocusedId | null) => void;
        onlongPress: (f: FocusedId) => void;
        ondesktopNodeClick: (f: FocusedId) => void;
        onclearFocus: () => void;
        onclosePanMode: () => void;
        onspacePanChange: (v: boolean) => void;
    };

    let {
        editMode,
        panActive,
        panMode,
        chart,
        displayedStemmaIndex,
        findPendingFamily,
        popHover,
        onattachPersonToFamily,
        oncreatePersonInFamily,
        oncreatePendingFamily,
        onshortTapFocus,
        onlongPress,
        ondesktopNodeClick,
        onclearFocus,
        onclosePanMode,
        onspacePanChange,
    }: Props = $props();

    const PERSON_DRAG_MIME = "application/x-stemma-person";

    let activeGestureSource = $state<SourceRef | null>(null);
    let dragTip = $state<{ text: string; x: number; y: number } | null>(null);

    function personNameOf(personId: string): string {
        return displayedStemmaIndex?.person(personId)?.name || "?";
    }

    function familyParentNames(familyId: string): string[] {
        const f = displayedStemmaIndex?.family(familyId);
        return f ? f.parents.map(personNameOf) : [];
    }

    function familyChildrenNames(familyId: string): string[] {
        const f = displayedStemmaIndex?.family(familyId);
        return f ? f.children.map(personNameOf) : [];
    }

    function joinNames(names: string[]): string {
        if (names.length === 0) return "?";
        if (names.length === 1) return names[0];
        const conj = $t("namesJoin");
        if (names.length === 2) return names.join(conj);
        const sep = $t("namesSeparator");
        return names.slice(0, -1).join(sep) + conj + names[names.length - 1];
    }

    type FamilyAnchor = { names: string[]; via: "parents" | "children" };

    function familyAnchor(familyId: string): FamilyAnchor {
        const parents = familyParentNames(familyId);
        if (parents.length > 0) return { names: parents, via: "parents" };
        return { names: familyChildrenNames(familyId), via: "children" };
    }

    function nodeKind(nodeId: string): "person" | "family" {
        return nodeId.startsWith("person_") ? "person" : "family";
    }

    let dropClasses = new Map<string, DropClass>();

    /**
     * Real node under a client point, as the old DOM hit-test saw it: pending
     * people and drop-disallowed nodes (pointer-events: none) are transparent,
     * and a ghost on top hides whatever is under it.
     */
    function findNodeUnder(c: CanvasChart, clientX: number, clientY: number): NodeHit | null {
        if (c.hitGhost(clientX, clientY)) return null;
        const disallowed = dropClasses;
        const node = c.hitNode(clientX, clientY, { skip: (n) => disallowed.get(n.id) === "drop-disallowed" });
        if (!node) return null;
        const kind = nodeKind(node.id);
        const id = denormalizeId(node.id);
        if (kind === "person" && isPendingId(id)) return null;
        return { ref: { kind, id }, node };
    }

    function classifyForDrop(src: SourceRef, nodeId: string): DropClass | null {
        const id = denormalizeId(nodeId);
        const kind = nodeKind(nodeId);
        if (kind === "person" && isPendingPersonId(id)) return null;
        if (src.kind === "person") {
            if (kind !== "family") return null;
            if (isPendingFamilyId(id)) {
                const pending = findPendingFamily(id);
                if (!pending) return null;
                return pending.parents.includes(src.id) || pending.children.includes(src.id)
                    ? "drop-disallowed"
                    : "drop-allowed";
            }
            const c = displayedStemmaIndex?.canAddParent(id, src.id);
            if (!c) return null;
            return c.ok ? "drop-allowed" : "drop-disallowed";
        }
        if (src.kind === "family") {
            if (kind !== "person") return null;
            if (src.id === id) return null;
            if (isPendingFamilyId(src.id)) {
                const pending = findPendingFamily(src.id);
                if (!pending) return null;
                if (pending.parents.includes(id) || pending.children.includes(id)) return "drop-disallowed";
                if (displayedStemmaIndex?.hasParentFamily(id)) return "drop-disallowed";
                return "drop-allowed";
            }
            const c = displayedStemmaIndex?.canAddChild(src.id, id);
            if (!c) return null;
            return c.ok ? "drop-allowed" : "drop-disallowed";
        }
        return null;
    }


    // HTML5 DnD: tray chip → canvas family target. Tray person becomes spouse (parent).
    $effect(() => {
        if (!chart) return;
        const c = chart;
        const canvasEl = c.canvas;
        const familyUnder = (e: DragEvent) => {
            const n = c.hitNode(e.clientX, e.clientY);
            return n && n.type === "family" ? n : null;
        };

        const onDragOver = (e: DragEvent) => {
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes(PERSON_DRAG_MIME)) return;
            const g = familyUnder(e);
            c.setDropTarget(g?.id ?? null);
            if (!g) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "link";
        };
        const onDragLeave = (_e: DragEvent) => {
            c.setDropTarget(null);
        };
        const onDrop = (e: DragEvent) => {
            const g = familyUnder(e);
            c.setDropTarget(null);
            if (!g || !e.dataTransfer) return;
            const pid = e.dataTransfer.getData(PERSON_DRAG_MIME);
            const fid = denormalizeId(g.id);
            if (!pid || !fid) return;
            if (isPendingId(pid)) return;
            e.preventDefault();
            const dropSvg = c.clientToWorld(e.clientX, e.clientY);
            onattachPersonToFamily(pid, fid, "parent", dropSvg);
        };

        canvasEl.addEventListener("dragover", onDragOver);
        canvasEl.addEventListener("dragleave", onDragLeave);
        canvasEl.addEventListener("drop", onDrop);
        return () => {
            canvasEl.removeEventListener("dragover", onDragOver);
            canvasEl.removeEventListener("dragleave", onDragLeave);
            canvasEl.removeEventListener("drop", onDrop);
        };
    });

    // Canvas pointer gesture: drag person↔family. Empty source/target supported.
    $effect(() => {
        if (!editMode || !chart) return;
        const c = chart;
        const canvasEl = c.canvas;

        const PERSON_PREVIEW_R = 15;
        const FAMILY_PREVIEW_R = 7;

        let gesture: {
            source: SourceRef;
            sourceCenter: { x: number; y: number };
            startClientX: number;
            startClientY: number;
            startMs: number;
            active: boolean;
            sourceNodeId: string | null;
            sourceMarker: { x: number; y: number } | null;
            line: { x1: number; y1: number; x2: number; y2: number } | null;
            endpointPreview: { x: number; y: number; r: number } | null;
            lastTarget: string | null;
        } | null = null;

        let longPressTimer: ReturnType<typeof setTimeout> | null = null;

        const cancelLongPress = () => {
            if (longPressTimer !== null) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        const syncOverlay = () => {
            c.setOverlay({
                line: gesture?.line ?? null,
                sourceMarker: gesture?.sourceMarker ?? null,
                preview: gesture?.endpointPreview ?? null,
            });
        };

        const cleanup = () => {
            cancelLongPress();
            document.body.classList.remove("linking");
            if (!gesture) return;
            c.setDropTarget(null);
            c.setGestureSource(null);
            gesture = null;
            syncOverlay();
            dragTip = null;
            activeGestureSource = null;
        };

        const targetCompatibility = (
            source: SourceRef,
            overInfo: NodeHit | null,
        ): "valid" | "noop" | "create-empty" => {
            if (source.kind === "person") {
                if (overInfo?.ref.kind === "family") {
                    if (isPendingFamilyId(overInfo.ref.id)) {
                        const pending = findPendingFamily(overInfo.ref.id);
                        if (!pending) return "noop";
                        if (pending.parents.includes(source.id) || pending.children.includes(source.id)) return "noop";
                        return "valid";
                    }
                    const c = displayedStemmaIndex?.canAddParent(overInfo.ref.id, source.id);
                    return c?.ok ? "valid" : "noop";
                }
                if (!overInfo) return "create-empty";
                return "noop";
            }
            if (source.kind === "family") {
                if (overInfo?.ref.kind === "person") {
                    if (isPendingFamilyId(source.id)) {
                        const pending = findPendingFamily(source.id);
                        if (!pending) return "noop";
                        if (pending.parents.includes(overInfo.ref.id) || pending.children.includes(overInfo.ref.id))
                            return "noop";
                        if (displayedStemmaIndex?.hasParentFamily(overInfo.ref.id)) return "noop";
                        return "valid";
                    }
                    const c = displayedStemmaIndex?.canAddChild(source.id, overInfo.ref.id);
                    return c?.ok ? "valid" : "noop";
                }
                if (!overInfo) return "create-empty";
                return "noop";
            }
            if (source.kind === "empty") {
                if (overInfo?.ref.kind === "family") {
                    // Pending families always carry a single member; adding
                    // the modal-created spouse promotes them. Real families
                    // already at 2 parents would land a 3rd spouse — block.
                    if (isPendingFamilyId(overInfo.ref.id)) return "valid";
                    const fam = displayedStemmaIndex?.family(overInfo.ref.id);
                    if (!fam) return "noop";
                    if ((fam.parents?.length ?? 0) >= 2) return "noop";
                    return "valid";
                }
                if (overInfo?.ref.kind === "person") {
                    if (displayedStemmaIndex?.hasParentFamily(overInfo.ref.id)) return "noop";
                    return "valid";
                }
                return "noop";
            }
            return "noop";
        };

        const onPointerStart = (e: PointerEvent) => {
            const targetNode = c.hitGhost(e.clientX, e.clientY) ? null : c.hitNode(e.clientX, e.clientY);
            let source: SourceRef;
            let center: { x: number; y: number };
            let sourceNodeId: string | null = null;
            if (targetNode) {
                const kind = nodeKind(targetNode.id);
                const sourceId = denormalizeId(targetNode.id);
                if (kind === "person" && isPendingPersonId(sourceId)) return;
                source = { kind, id: sourceId };
                center = { x: targetNode.x, y: targetNode.y };
                sourceNodeId = targetNode.id;
                popHover();
            } else {
                source = { kind: "empty" };
                center = c.clientToWorld(e.clientX, e.clientY);
            }
            gesture = {
                source,
                sourceCenter: center,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startMs: Date.now(),
                active: false,
                sourceNodeId,
                sourceMarker: null,
                line: null,
                endpointPreview: null,
                lastTarget: null,
            };
            document.body.classList.add("linking");
            e.preventDefault();

            if (e.pointerType !== "mouse" && sourceNodeId) {
                const capturedId = sourceNodeId;
                longPressTimer = setTimeout(() => {
                    longPressTimer = null;
                    if (!gesture || gesture.active) return;
                    const focused = focusedIdFromNodeId(capturedId, isPendingId);
                    if (focused) {
                        cleanup();
                        onlongPress(focused);
                    }
                }, TAP_MAX_MS);
            }
        };

        const computeTipText = (overInfo: NodeHit | null, source: SourceRef): string | null => {
            if (source.kind === "person") {
                if (overInfo?.ref.kind === "family") {
                    const anchor = familyAnchor(overInfo.ref.id);
                    const key = anchor.via === "parents" ? "tipIsSpouse" : "tipIsParent";
                    const param = anchor.via === "parents" ? "family" : "names";
                    return $t(key, { person: personNameOf(source.id), [param]: joinNames(anchor.names) });
                }
                if (!overInfo) return $t("tipPersonHasSpouse", { name: personNameOf(source.id) });
                return null;
            }
            if (source.kind === "family") {
                if (!overInfo) {
                    const parents = familyParentNames(source.id);
                    if (parents.length > 1) return $t("tipParentsHaveChildren", { names: joinNames(parents) });
                    return $t("tipParentHasChildren", { name: joinNames(parents) });
                }
                if (overInfo.ref.kind === "person") {
                    return $t("tipIsChild", {
                        person: personNameOf(overInfo.ref.id),
                        family: joinNames(familyParentNames(source.id)),
                    });
                }
                return null;
            }
            if (source.kind === "empty") {
                if (overInfo?.ref.kind === "family") {
                    const anchor = familyAnchor(overInfo.ref.id);
                    if (anchor.via === "parents") {
                        return $t("tipPersonHasSpouse", { name: joinNames(anchor.names) });
                    }
                    const key = anchor.names.length > 1 ? "tipChildrenHaveParent" : "tipChildHasParent";
                    const param = anchor.names.length > 1 ? "names" : "name";
                    return $t(key, { [param]: joinNames(anchor.names) });
                }
                if (overInfo?.ref.kind === "person") {
                    return $t("tipPersonHasParents", { name: personNameOf(overInfo.ref.id) });
                }
                return null;
            }
            return null;
        };

        const updateEndpointPreview = (
            svgPt: { x: number; y: number },
            overInfo: NodeHit | null,
        ) => {
            if (!gesture) return;
            const src = gesture.source;
            let previewKind: "person" | "family" | null = null;
            if (!overInfo) {
                if (src.kind === "family") previewKind = "person";
                else if (src.kind === "person") previewKind = "family";
            } else if (overInfo.ref.kind === "person" && src.kind === "empty") {
                previewKind = "family";
            }
            if (!previewKind) {
                gesture.endpointPreview = null;
                return;
            }
            const r = previewKind === "person" ? PERSON_PREVIEW_R : FAMILY_PREVIEW_R;
            gesture.endpointPreview = { x: svgPt.x, y: svgPt.y, r };
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!gesture) return;
            const dx = e.clientX - gesture.startClientX;
            const dy = e.clientY - gesture.startClientY;
            if (Math.hypot(dx, dy) > TAP_MAX_MOVE_PX) cancelLongPress();
            if (!gesture.active) {
                if (Math.hypot(dx, dy) <= 6) return;
                gesture.active = true;
                cancelLongPress();
                activeGestureSource = gesture.source;
                gesture.line = {
                    x1: gesture.sourceCenter.x,
                    y1: gesture.sourceCenter.y,
                    x2: gesture.sourceCenter.x,
                    y2: gesture.sourceCenter.y,
                };
                if (gesture.source.kind === "empty") {
                    gesture.sourceMarker = { x: gesture.sourceCenter.x, y: gesture.sourceCenter.y };
                }
                c.setGestureSource(gesture.sourceNodeId);
            }
            const svgPt = c.clientToWorld(e.clientX, e.clientY);
            if (gesture.line) gesture.line = { ...gesture.line, x2: svgPt.x, y2: svgPt.y };
            const overInfo = findNodeUnder(c, e.clientX, e.clientY);
            const overId = overInfo?.node.id ?? null;
            const compat = targetCompatibility(gesture.source, overInfo);
            if (overId !== gesture.lastTarget) {
                gesture.lastTarget = overId && compat === "valid" ? overId : null;
                c.setDropTarget(gesture.lastTarget);
            }
            updateEndpointPreview(svgPt, overInfo);
            syncOverlay();
            const tipText = compat === "noop" ? null : computeTipText(overInfo, gesture.source);
            dragTip = tipText ? { text: tipText, x: e.clientX, y: e.clientY } : null;
        };

        const onPointerEnd = (e: PointerEvent) => {
            if (!gesture) return;
            const wasActive = gesture.active;
            const source = gesture.source;
            const startCenter = gesture.sourceCenter;
            const sourceNodeId = gesture.sourceNodeId;
            const elapsed = Date.now() - gesture.startMs;
            const moved = Math.hypot(e.clientX - gesture.startClientX, e.clientY - gesture.startClientY);
            const overInfo = findNodeUnder(c, e.clientX, e.clientY);
            cleanup();
            if (!wasActive) {
                if (e.pointerType !== "mouse") {
                    if (isShortTap(elapsed, moved)) {
                        if (sourceNodeId) {
                            onshortTapFocus(focusedIdFromNodeId(sourceNodeId, isPendingId));
                        } else {
                            onshortTapFocus(null);
                        }
                    }
                    return;
                }
                if (sourceNodeId) {
                    const focused = focusedIdFromNodeId(sourceNodeId, isPendingId);
                    if (focused) ondesktopNodeClick(focused);
                }
                return;
            }

            // Re-check compatibility at drop. Hover-time compat only drives the
            // visual highlight; without this guard a drop on a "disallowed"
            // target (e.g. family with 2 parents) would still fire
            // attachPersonToFamily and the backend would reject the implicit
            // 3rd-parent update.
            if (targetCompatibility(source, overInfo) === "noop") return;

            if (source.kind === "person" && overInfo?.ref.kind === "family") {
                onattachPersonToFamily(source.id, overInfo.ref.id, "parent", startCenter);
                return;
            }
            if (source.kind === "family" && overInfo?.ref.kind === "person") {
                const tgtCenter = { x: overInfo.node.x, y: overInfo.node.y };
                onattachPersonToFamily(overInfo.ref.id, source.id, "child", tgtCenter);
                return;
            }
            if (source.kind === "empty" && overInfo?.ref.kind === "family") {
                const anchor = familyAnchor(overInfo.ref.id);
                const title = anchor.via === "parents"
                    ? $t("createSpouseTitleOf", { name: joinNames(anchor.names) })
                    : $t("createParentTitleOf", { names: joinNames(anchor.names) });
                oncreatePersonInFamily(overInfo.ref.id, "parent", title, startCenter);
                return;
            }
            if (source.kind === "family" && !overInfo) {
                const releaseSvg = c.clientToWorld(e.clientX, e.clientY);
                const title = $t("createChildTitleOf", { names: joinNames(familyParentNames(source.id)) });
                oncreatePersonInFamily(source.id, "child", title, releaseSvg);
                return;
            }
            if (source.kind === "person" && !overInfo) {
                const releaseSvg = c.clientToWorld(e.clientX, e.clientY);
                oncreatePendingFamily(source.id, "parent", releaseSvg);
                return;
            }
            if (source.kind === "empty" && overInfo?.ref.kind === "person") {
                if (displayedStemmaIndex?.hasParentFamily(overInfo.ref.id)) return;
                oncreatePendingFamily(overInfo.ref.id, "child", startCenter);
                return;
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                cleanup();
                onclearFocus();
            }
        };

        const onCancel = () => cleanup();
        // d3.drag attaches a mousedown listener to the canvas and restarts
        // the force simulation on press, which would scramble pinned positions
        // mid-gesture. Capturing pointerdown at the svg root and stopping
        // propagation prevents the d3 handler from ever seeing it.
        const onPointerDownCapture = (e: PointerEvent) => {
            if (panActive) return;
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.stopImmediatePropagation();
            onPointerStart(e);
        };
        // touchstart fires before pointerdown, so d3.zoom would start a pan in
        // parallel with the link gesture; swallow single-finger touch, let
        // pinch through. preventDefault also suppresses the synthesized
        // mousedown/click that would otherwise wake d3.drag and d3-selection's
        // click handler, opening the edit modal on every short tap.
        const onTouchStartCapture = (e: TouchEvent) => {
            if (panActive) return;
            if (e.touches.length !== 1) return;
            e.stopImmediatePropagation();
            e.preventDefault();
        };
        // Edit-mode mouse drag must not pin simulation physics via d3.drag.
        const onMouseDownCapture = (e: MouseEvent) => {
            if (panActive) return;
            if (e.button !== 0) return;
            e.stopImmediatePropagation();
        };
        // Swallow click in edit mode so taps focus (via gesture machine)
        // instead of opening the edit modal via the chart's d3 click handler.
        const onClickCapture = (e: MouseEvent) => {
            if (panActive) return;
            e.stopImmediatePropagation();
        };
        canvasEl.addEventListener("pointerdown", onPointerDownCapture, true);
        canvasEl.addEventListener("touchstart", onTouchStartCapture, true);
        canvasEl.addEventListener("mousedown", onMouseDownCapture, true);
        canvasEl.addEventListener("click", onClickCapture, true);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerEnd);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("contextmenu", onCancel);
        window.addEventListener("blur", onCancel);
        return () => {
            canvasEl.removeEventListener("pointerdown", onPointerDownCapture, true);
            canvasEl.removeEventListener("touchstart", onTouchStartCapture, true);
            canvasEl.removeEventListener("mousedown", onMouseDownCapture, true);
            canvasEl.removeEventListener("click", onClickCapture, true);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerEnd);
            window.removeEventListener("pointercancel", onCancel);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("contextmenu", onCancel);
            window.removeEventListener("blur", onCancel);
            cleanup();
        };
    });

    $effect(() => {
        const src = activeGestureSource;
        if (!src || src.kind === "empty" || !chart) return;
        const c = chart;
        // Read so the effect tracks index rebuilds (pending add/remove etc).
        void displayedStemmaIndex;
        const classes = new Map<string, DropClass>();
        for (const n of c.nodes) {
            const cls = classifyForDrop(src, n.id);
            if (cls) classes.set(n.id, cls);
        }
        dropClasses = classes;
        c.setDropClasses(classes);
        return () => {
            dropClasses = new Map();
            c.setDropClasses(new Map());
        };
    });

    $effect(() => {
        if (!panActive) {
            document.body.classList.remove("pan-armed", "pan-dragging");
            return;
        }
        document.body.classList.add("pan-armed");
        const onDown = () => document.body.classList.add("pan-dragging");
        const onUp = () => document.body.classList.remove("pan-dragging");
        window.addEventListener("mousedown", onDown);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("mouseup", onUp);
            document.body.classList.remove("pan-armed", "pan-dragging");
        };
    });

    $effect(() => {
        if (!editMode) return;
        const isTypingTarget = (target: EventTarget | null): boolean => {
            if (!(target instanceof HTMLElement)) return false;
            const tag = target.tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (isTypingTarget(e.target)) return;
                if (panMode && !activeGestureSource && !document.querySelector(".modal-panel")) {
                    onclosePanMode();
                }
                return;
            }
            if (e.code !== "Space" || e.repeat) return;
            if (isTypingTarget(e.target)) return;
            onspacePanChange(true);
            e.preventDefault();
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code !== "Space") return;
            onspacePanChange(false);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            onspacePanChange(false);
        };
    });
</script>

{#if dragTip}
    <div
        class="drag-tip"
        style="left: {dragTip.x + 14}px; top: {dragTip.y + 14}px;"
        data-testid="drag-tip"
    >
        {dragTip.text}
    </div>
{/if}

<style>
    :global(body.linking),
    :global(body.linking *) {
        cursor: crosshair !important;
        user-select: none !important;
        -webkit-user-select: none !important;
    }

    :global(body.pan-armed),
    :global(body.pan-armed *) {
        cursor: grab !important;
    }

    :global(body.pan-dragging),
    :global(body.pan-dragging *) {
        cursor: grabbing !important;
    }

    .drag-tip {
        position: fixed;
        pointer-events: none;
        background: rgba(13, 110, 253, 0.95);
        color: #fff;
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 0.82rem;
        font-weight: 500;
        max-width: min(320px, 80vw);
        overflow-wrap: anywhere;
        z-index: 400;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
</style>
