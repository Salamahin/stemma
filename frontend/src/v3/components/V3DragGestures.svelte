<script lang="ts">
    import { denormalizeId } from "../../graphTools";
    import { arrowPath } from "../../graphStyles";
    import { t } from "../../i18n";
    import type { StemmaIndex } from "../../stemmaIndex";
    import { focusedIdFromG, isShortTap, type FocusedId } from "../focusGesture";
    import {
        isPendingFamilyId,
        isPendingId,
        isPendingPersonId,
        type PendingFamily,
    } from "../pendingState";
    import {
        clientToSvgPoint,
        findNodeUnder,
        nodeCenter,
        type NodeRef,
    } from "../v3DomGeometry";

    type SourceRef = { kind: "person"; id: string } | { kind: "family"; id: string } | { kind: "empty" };

    type Props = {
        editMode: boolean;
        panActive: boolean;
        panMode: boolean;
        stemmaChartReady: boolean;
        displayedStemmaIndex: StemmaIndex | null;
        findPendingFamily: (id: string) => PendingFamily | undefined;
        popHover: () => void;
        onattachPersonToFamily: (
            personId: string,
            familyId: string,
            role: "parent" | "child",
            pinAt?: { x: number; y: number },
        ) => void;
        oncreatePersonInFamily: (
            familyId: string,
            role: "parent" | "child",
            title: string,
            pinAt?: { x: number; y: number },
        ) => void;
        oncreatePendingFamily: (
            personId: string,
            role: "parent" | "child",
            familyAt: { x: number; y: number },
        ) => void;
        onactiveGestureSource: (src: SourceRef | null) => void;
        onshortTapFocus: (f: FocusedId | null) => void;
        onclearFocus: () => void;
        onclosePanMode: () => void;
        onspacePanChange: (v: boolean) => void;
    };

    let {
        editMode,
        panActive,
        panMode,
        stemmaChartReady,
        displayedStemmaIndex,
        findPendingFamily,
        popHover,
        onattachPersonToFamily,
        oncreatePersonInFamily,
        oncreatePendingFamily,
        onactiveGestureSource,
        onshortTapFocus,
        onclearFocus,
        onclosePanMode,
        onspacePanChange,
    }: Props = $props();

    const PERSON_DRAG_MIME = "application/x-stemma-person";
    const SVG_NS = "http://www.w3.org/2000/svg";

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
        const conj = $t("v2.namesJoin");
        if (names.length === 2) return names.join(conj);
        const sep = $t("v2.namesSeparator");
        return names.slice(0, -1).join(sep) + conj + names[names.length - 1];
    }

    type FamilyAnchor = { names: string[]; via: "parents" | "children" };

    function familyAnchor(familyId: string): FamilyAnchor {
        const parents = familyParentNames(familyId);
        if (parents.length > 0) return { names: parents, via: "parents" };
        return { names: familyChildrenNames(familyId), via: "children" };
    }

    function classifyForDrop(src: SourceRef, g: Element): "v3-drop-allowed" | "v3-drop-disallowed" | null {
        const id = denormalizeId(g.id);
        const kind: "person" | "family" = g.id.startsWith("person_") ? "person" : "family";
        if (kind === "person" && isPendingPersonId(id)) return null;
        if (src.kind === "person") {
            if (kind !== "family") return null;
            if (isPendingFamilyId(id)) {
                const pending = findPendingFamily(id);
                if (!pending) return null;
                return pending.parents.includes(src.id) || pending.children.includes(src.id)
                    ? "v3-drop-disallowed"
                    : "v3-drop-allowed";
            }
            const c = displayedStemmaIndex?.canAddParent(id, src.id);
            if (!c) return null;
            return c.ok ? "v3-drop-allowed" : "v3-drop-disallowed";
        }
        if (src.kind === "family") {
            if (kind !== "person") return null;
            if (src.id === id) return null;
            if (isPendingFamilyId(src.id)) {
                const pending = findPendingFamily(src.id);
                if (!pending) return null;
                if (pending.parents.includes(id) || pending.children.includes(id)) return "v3-drop-disallowed";
                if (displayedStemmaIndex?.hasParentFamily(id)) return "v3-drop-disallowed";
                return "v3-drop-allowed";
            }
            const c = displayedStemmaIndex?.canAddChild(src.id, id);
            if (!c) return null;
            return c.ok ? "v3-drop-allowed" : "v3-drop-disallowed";
        }
        return null;
    }

    function setActiveGestureSource(src: SourceRef | null): void {
        activeGestureSource = src;
        onactiveGestureSource(src);
    }

    // HTML5 DnD: tray chip → canvas family target. Tray person becomes spouse (parent).
    $effect(() => {
        if (!stemmaChartReady) return;
        const svgEl = document.getElementById("chart") as unknown as SVGSVGElement | null;
        if (!svgEl) return;

        const onDragOver = (e: DragEvent) => {
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes(PERSON_DRAG_MIME)) return;
            const g = (e.target as Element | null)?.closest?.("g[id^='family_']") as SVGGElement | null;
            if (!g) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "link";
            g.classList.add("v3-drop-target");
        };
        const onDragLeave = (e: DragEvent) => {
            const g = (e.target as Element | null)?.closest?.("g[id^='family_']") as SVGGElement | null;
            g?.classList.remove("v3-drop-target");
        };
        const onDrop = (e: DragEvent) => {
            const g = (e.target as Element | null)?.closest?.("g[id^='family_']") as SVGGElement | null;
            if (!g || !e.dataTransfer) return;
            const pid = e.dataTransfer.getData(PERSON_DRAG_MIME);
            const fid = denormalizeId(g.id);
            g.classList.remove("v3-drop-target");
            if (!pid || !fid) return;
            if (isPendingId(pid)) return;
            e.preventDefault();
            const dropSvg = clientToSvgPoint(svgEl, e.clientX, e.clientY);
            onattachPersonToFamily(pid, fid, "parent", dropSvg);
        };

        svgEl.addEventListener("dragover", onDragOver);
        svgEl.addEventListener("dragleave", onDragLeave);
        svgEl.addEventListener("drop", onDrop);
        return () => {
            svgEl.removeEventListener("dragover", onDragOver);
            svgEl.removeEventListener("dragleave", onDragLeave);
            svgEl.removeEventListener("drop", onDrop);
        };
    });

    // Canvas pointer gesture: drag person↔family. Empty source/target supported.
    $effect(() => {
        if (!editMode || !stemmaChartReady) return;
        const svgEl = document.getElementById("chart") as unknown as SVGSVGElement | null;
        if (!svgEl) return;

        const PERSON_PREVIEW_R = 15;
        const FAMILY_PREVIEW_R = 7;

        let gesture: {
            source: SourceRef;
            sourceCenter: { x: number; y: number };
            startClientX: number;
            startClientY: number;
            startMs: number;
            active: boolean;
            sourceGEl: SVGGElement | null;
            sourceMarker: SVGCircleElement | null;
            line: SVGLineElement | null;
            endpointPreview: SVGCircleElement | null;
            lastTarget: SVGGElement | null;
        } | null = null;

        const clearTargetHighlight = () => {
            if (gesture?.lastTarget) gesture.lastTarget.classList.remove("v3-drop-target");
        };

        const removeSvgEl = (el: Element | null) => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        };

        const ensureArrowMarker = () => {
            if (svgEl.querySelector("defs > marker#v3-arrow")) return;
            let defs = svgEl.querySelector("defs") as SVGDefsElement | null;
            if (!defs) {
                defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement;
                svgEl.insertBefore(defs, svgEl.firstChild);
            }
            const marker = document.createElementNS(SVG_NS, "marker");
            marker.setAttribute("id", "v3-arrow");
            marker.setAttribute("viewBox", "0 0 10 6");
            marker.setAttribute("refX", "10");
            marker.setAttribute("refY", "3");
            marker.setAttribute("markerWidth", "10");
            marker.setAttribute("markerHeight", "6");
            marker.setAttribute("markerUnits", "userSpaceOnUse");
            marker.setAttribute("orient", "auto");
            marker.setAttribute("fill", "#0d6efd");
            const path = document.createElementNS(SVG_NS, "path");
            path.setAttribute("d", arrowPath);
            marker.appendChild(path);
            defs.appendChild(marker);
        };

        const cleanup = () => {
            document.body.classList.remove("v3-linking");
            if (!gesture) return;
            clearTargetHighlight();
            removeSvgEl(gesture.line);
            removeSvgEl(gesture.sourceMarker);
            removeSvgEl(gesture.endpointPreview);
            gesture.sourceGEl?.classList.remove("v3-gesture-source");
            gesture = null;
            dragTip = null;
            setActiveGestureSource(null);
        };

        const targetCompatibility = (
            source: SourceRef,
            overInfo: { ref: NodeRef } | null,
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
                if (overInfo?.ref.kind === "family") return "valid";
                if (overInfo?.ref.kind === "person") {
                    if (displayedStemmaIndex?.hasParentFamily(overInfo.ref.id)) return "noop";
                    return "valid";
                }
                return "noop";
            }
            return "noop";
        };

        const onPointerStart = (e: PointerEvent) => {
            const targetG = (e.target as Element | null)?.closest?.("g[id^='person_'], g[id^='family_']") as SVGGElement | null;
            let source: SourceRef;
            let center: { x: number; y: number };
            let sourceGEl: SVGGElement | null = null;
            if (targetG) {
                const kind = targetG.id.startsWith("person_") ? "person" : "family";
                const sourceId = denormalizeId(targetG.id);
                if (kind === "person" && isPendingPersonId(sourceId)) return;
                const c = nodeCenter(targetG);
                if (!c) return;
                source = { kind, id: sourceId };
                center = c;
                sourceGEl = targetG;
                popHover();
            } else {
                source = { kind: "empty" };
                center = clientToSvgPoint(svgEl, e.clientX, e.clientY);
            }
            gesture = {
                source,
                sourceCenter: center,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startMs: Date.now(),
                active: false,
                sourceGEl,
                sourceMarker: null,
                line: null,
                endpointPreview: null,
                lastTarget: null,
            };
            document.body.classList.add("v3-linking");
            e.preventDefault();
        };

        const computeTipText = (overInfo: { ref: NodeRef } | null, source: SourceRef): string | null => {
            if (source.kind === "person") {
                if (overInfo?.ref.kind === "family") {
                    const anchor = familyAnchor(overInfo.ref.id);
                    const key = anchor.via === "parents" ? "v2.tipIsSpouse" : "v2.tipIsParent";
                    const param = anchor.via === "parents" ? "family" : "names";
                    return $t(key, { person: personNameOf(source.id), [param]: joinNames(anchor.names) });
                }
                if (!overInfo) return $t("v2.tipPersonHasSpouse", { name: personNameOf(source.id) });
                return null;
            }
            if (source.kind === "family") {
                if (!overInfo) {
                    const parents = familyParentNames(source.id);
                    if (parents.length > 1) return $t("v2.tipParentsHaveChildren", { names: joinNames(parents) });
                    return $t("v2.tipParentHasChildren", { name: joinNames(parents) });
                }
                if (overInfo.ref.kind === "person") {
                    return $t("v2.tipIsChild", {
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
                        return $t("v2.tipPersonHasSpouse", { name: joinNames(anchor.names) });
                    }
                    const key = anchor.names.length > 1 ? "v2.tipChildrenHaveParent" : "v2.tipChildHasParent";
                    const param = anchor.names.length > 1 ? "names" : "name";
                    return $t(key, { [param]: joinNames(anchor.names) });
                }
                if (overInfo?.ref.kind === "person") {
                    return $t("v2.tipPersonHasParents", { name: personNameOf(overInfo.ref.id) });
                }
                return null;
            }
            return null;
        };

        const updateEndpointPreview = (
            mainG: SVGGElement | null,
            svgPt: { x: number; y: number },
            overInfo: { ref: NodeRef } | null,
        ) => {
            if (!gesture) return;
            const src = gesture.source;
            const hidePreview = () => {
                if (gesture?.endpointPreview) gesture.endpointPreview.style.display = "none";
            };
            let previewKind: "person" | "family" | null = null;
            if (!overInfo) {
                if (src.kind === "family") previewKind = "person";
                else if (src.kind === "person") previewKind = "family";
            } else if (overInfo.ref.kind === "person" && src.kind === "empty") {
                previewKind = "family";
            }
            if (!previewKind) {
                hidePreview();
                return;
            }
            const r = previewKind === "person" ? PERSON_PREVIEW_R : FAMILY_PREVIEW_R;
            const previewClass = `v3-endpoint-preview v3-endpoint-${previewKind}`;
            if (gesture.endpointPreview && gesture.endpointPreview.getAttribute("class") !== previewClass) {
                gesture.endpointPreview.parentNode?.removeChild(gesture.endpointPreview);
                gesture.endpointPreview = null;
            }
            if (!gesture.endpointPreview && mainG) {
                const p = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
                p.setAttribute("class", previewClass);
                mainG.appendChild(p);
                gesture.endpointPreview = p;
            }
            if (gesture.endpointPreview) {
                gesture.endpointPreview.style.display = "";
                gesture.endpointPreview.setAttribute("cx", String(svgPt.x));
                gesture.endpointPreview.setAttribute("cy", String(svgPt.y));
                gesture.endpointPreview.setAttribute("r", String(r));
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!gesture) return;
            const dx = e.clientX - gesture.startClientX;
            const dy = e.clientY - gesture.startClientY;
            if (!gesture.active) {
                if (Math.hypot(dx, dy) <= 6) return;
                gesture.active = true;
                setActiveGestureSource(gesture.source);
                const mainG = svgEl.querySelector("g.main") as SVGGElement | null;
                if (mainG) {
                    ensureArrowMarker();
                    const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
                    line.setAttribute("class", "v3-link-line");
                    line.setAttribute("x1", String(gesture.sourceCenter.x));
                    line.setAttribute("y1", String(gesture.sourceCenter.y));
                    line.setAttribute("x2", String(gesture.sourceCenter.x));
                    line.setAttribute("y2", String(gesture.sourceCenter.y));
                    line.setAttribute("marker-end", "url(#v3-arrow)");
                    mainG.appendChild(line);
                    gesture.line = line;
                    if (gesture.source.kind === "empty") {
                        const marker = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
                        marker.setAttribute("class", "v3-empty-source-marker");
                        marker.setAttribute("cx", String(gesture.sourceCenter.x));
                        marker.setAttribute("cy", String(gesture.sourceCenter.y));
                        marker.setAttribute("r", "8");
                        mainG.appendChild(marker);
                        gesture.sourceMarker = marker;
                    }
                }
                gesture.sourceGEl?.classList.add("v3-gesture-source");
            }
            const svgPt = clientToSvgPoint(svgEl, e.clientX, e.clientY);
            if (gesture.line) {
                gesture.line.setAttribute("x2", String(svgPt.x));
                gesture.line.setAttribute("y2", String(svgPt.y));
            }
            const overInfo = findNodeUnder(e.clientX, e.clientY);
            const overG = overInfo?.el ?? null;
            const compat = targetCompatibility(gesture.source, overInfo);
            if (overG !== gesture.lastTarget) {
                gesture.lastTarget?.classList.remove("v3-drop-target");
                gesture.lastTarget = null;
                if (overG && compat === "valid") {
                    overG.classList.add("v3-drop-target");
                    gesture.lastTarget = overG;
                }
            }
            const mainG = svgEl.querySelector("g.main") as SVGGElement | null;
            updateEndpointPreview(mainG, svgPt, overInfo);
            const tipText = compat === "noop" ? null : computeTipText(overInfo, gesture.source);
            dragTip = tipText ? { text: tipText, x: e.clientX, y: e.clientY } : null;
        };

        const onPointerEnd = (e: PointerEvent) => {
            if (!gesture) return;
            const wasActive = gesture.active;
            const source = gesture.source;
            const startCenter = gesture.sourceCenter;
            const sourceGEl = gesture.sourceGEl;
            const elapsed = Date.now() - gesture.startMs;
            const moved = Math.hypot(e.clientX - gesture.startClientX, e.clientY - gesture.startClientY);
            const overInfo = findNodeUnder(e.clientX, e.clientY);
            cleanup();
            if (!wasActive) {
                if (e.pointerType !== "mouse" && isShortTap(elapsed, moved)) {
                    if (sourceGEl) {
                        onshortTapFocus(focusedIdFromG(sourceGEl, isPendingId));
                    } else {
                        onshortTapFocus(null);
                    }
                }
                return;
            }

            if (source.kind === "person" && overInfo?.ref.kind === "family") {
                onattachPersonToFamily(source.id, overInfo.ref.id, "parent", startCenter);
                return;
            }
            if (source.kind === "family" && overInfo?.ref.kind === "person") {
                const tgtCenter = nodeCenter(overInfo.el) ?? undefined;
                onattachPersonToFamily(overInfo.ref.id, source.id, "child", tgtCenter);
                return;
            }
            if (source.kind === "empty" && overInfo?.ref.kind === "family") {
                const anchor = familyAnchor(overInfo.ref.id);
                const title = anchor.via === "parents"
                    ? $t("v2.createSpouseTitleOf", { name: joinNames(anchor.names) })
                    : $t("v2.createParentTitleOf", { names: joinNames(anchor.names) });
                oncreatePersonInFamily(overInfo.ref.id, "parent", title, startCenter);
                return;
            }
            if (source.kind === "family" && !overInfo) {
                const releaseSvg = clientToSvgPoint(svgEl, e.clientX, e.clientY);
                const title = $t("v2.createChildTitleOf", { names: joinNames(familyParentNames(source.id)) });
                oncreatePersonInFamily(source.id, "child", title, releaseSvg);
                return;
            }
            if (source.kind === "person" && !overInfo) {
                const releaseSvg = clientToSvgPoint(svgEl, e.clientX, e.clientY);
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
        // d3.drag attaches a pointerdown listener to each node g and restarts
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
        // pinch through.
        const onTouchStartCapture = (e: TouchEvent) => {
            if (panActive) return;
            if (e.touches.length !== 1) return;
            e.stopPropagation();
        };
        svgEl.addEventListener("pointerdown", onPointerDownCapture, true);
        svgEl.addEventListener("touchstart", onTouchStartCapture, true);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerEnd);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("contextmenu", onCancel);
        window.addEventListener("blur", onCancel);
        return () => {
            svgEl.removeEventListener("pointerdown", onPointerDownCapture, true);
            svgEl.removeEventListener("touchstart", onTouchStartCapture, true);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerEnd);
            window.removeEventListener("pointercancel", onCancel);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("contextmenu", onCancel);
            window.removeEventListener("blur", onCancel);
            cleanup();
        };
    });

    // Highlight compatible drop targets while a gesture is in progress.
    $effect(() => {
        const src = activeGestureSource;
        if (!src || src.kind === "empty") return;
        void displayedStemmaIndex;
        const svgEl = document.getElementById("chart");
        if (!svgEl) return;
        svgEl.querySelectorAll("g[id^='person_'], g[id^='family_']").forEach((g) => {
            g.classList.remove("v3-drop-allowed", "v3-drop-disallowed");
            const cls = classifyForDrop(src, g);
            if (cls) g.classList.add(cls);
        });
        return () => {
            svgEl.querySelectorAll("g.v3-drop-allowed, g.v3-drop-disallowed").forEach((g) => {
                g.classList.remove("v3-drop-allowed", "v3-drop-disallowed");
            });
        };
    });

    // Body cursor while pan is armed / actively dragging.
    $effect(() => {
        if (!panActive) {
            document.body.classList.remove("v3-pan-armed", "v3-pan-dragging");
            return;
        }
        document.body.classList.add("v3-pan-armed");
        const onDown = () => document.body.classList.add("v3-pan-dragging");
        const onUp = () => document.body.classList.remove("v3-pan-dragging");
        window.addEventListener("mousedown", onDown);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("mouseup", onUp);
            document.body.classList.remove("v3-pan-armed", "v3-pan-dragging");
        };
    });

    // Edit-mode keyboard: Escape closes pan, Space toggles momentary pan.
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
                if (panMode && !activeGestureSource && !document.querySelector(".v3-modal-panel")) {
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
        class="v3-drag-tip"
        style="left: {dragTip.x + 14}px; top: {dragTip.y + 14}px;"
        data-testid="v3-drag-tip"
    >
        {dragTip.text}
    </div>
{/if}

<style>
    :global(g.v3-drop-disallowed) {
        opacity: 0.3;
        filter: saturate(0.2);
        pointer-events: none;
    }

    :global(g.v3-drop-allowed > circle) {
        animation: v3-drop-allowed-pulse 1.8s ease-in-out infinite;
    }

    @keyframes v3-drop-allowed-pulse {
        0%, 100% { stroke-opacity: 1; }
        50% { stroke-opacity: 0.45; }
    }

    :global(g.v3-drop-target > circle) {
        stroke: #0d6efd;
        stroke-width: 3px;
        stroke-dasharray: 4 2;
        filter: drop-shadow(0 0 6px rgba(13, 110, 253, 0.55));
    }

    :global(g.v3-gesture-source > circle) {
        stroke: #0d6efd;
        stroke-width: 2.5px;
        filter: drop-shadow(0 0 8px rgba(13, 110, 253, 0.65));
    }

    :global(.v3-empty-source-marker) {
        fill: rgba(13, 110, 253, 0.08);
        stroke: #0d6efd;
        stroke-width: 1.5;
        stroke-dasharray: 4 3;
        opacity: 0.7;
        pointer-events: none;
    }

    :global(.v3-endpoint-preview) {
        fill: rgba(13, 110, 253, 0.08);
        stroke: #0d6efd;
        stroke-width: 1.5;
        stroke-dasharray: 4 3;
        opacity: 0.75;
        pointer-events: none;
    }

    :global(.v3-link-line) {
        stroke: #0d6efd;
        stroke-width: 2px;
        stroke-dasharray: 5 4;
        pointer-events: none;
        opacity: 0.7;
    }

    :global(body.v3-linking),
    :global(body.v3-linking *) {
        cursor: crosshair !important;
        user-select: none !important;
        -webkit-user-select: none !important;
    }

    :global(body.v3-pan-armed),
    :global(body.v3-pan-armed *) {
        cursor: grab !important;
    }

    :global(body.v3-pan-dragging),
    :global(body.v3-pan-dragging *) {
        cursor: grabbing !important;
    }

    .v3-drag-tip {
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
