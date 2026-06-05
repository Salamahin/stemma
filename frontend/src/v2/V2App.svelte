<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { AppController, type MutationResult } from "../appController";
    import type {
        FamilyDescription,
        PersonDefinition,
        PersonDescription,
        Stemma,
        StemmaDescription,
        TokenProvider,
        User,
    } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { HiglightLineages } from "../highlight";
    import { PinnedPeopleStorage } from "../pinnedPeopleStorage";
    import { ViewMode } from "../model";
    import { LocalizedError, t } from "../i18n";
    import { clearCredential, loadCredential, msUntilRefresh, saveCredential } from "../credentialStorage";
    import { initializeGoogleAuth, refreshCredential } from "../googleAuth";
    import Authenticate from "../components/Authenticate.svelte";
    import FullStemma from "../components/FullStemma.svelte";
    import V2Chip from "./components/V2Chip.svelte";
    import V2LangSwitcher from "./components/V2LangSwitcher.svelte";
    import V2Menu from "./components/V2Menu.svelte";
    import V2Fab from "./components/V2Fab.svelte";
    import V2Search from "./components/V2Search.svelte";
    import V2EmptyState from "./components/V2EmptyState.svelte";
    import V2Sheet from "./components/V2Sheet.svelte";
    import V2FamilyCard from "./components/V2FamilyCard.svelte";
    import V2BulkAddTray from "./components/V2BulkAddTray.svelte";
    import V2AboutModal from "./components/V2AboutModal.svelte";
    import V2SettingsModal from "./components/V2SettingsModal.svelte";
    import V2ShareAccessModal from "./components/V2ShareAccessModal.svelte";
    import V2PromptModal from "./components/V2PromptModal.svelte";
    import V2ConfirmModal from "./components/V2ConfirmModal.svelte";
    import V2PersonDetailsModal from "./components/V2PersonDetailsModal.svelte";
    import StatsCard from "../components/stats_card/StatsCard.svelte";
    import { buildInviteLink } from "../inviteLinkBuilder";
    import { Circle2 } from "svelte-loading-spinners";
    import { denormalizeId, normalizeId } from "../graphTools";
    import { arrowPath } from "../graphStyles";

    const PERSON_DRAG_MIME = "application/x-stemma-person";
    const SVG_NS = "http://www.w3.org/2000/svg";

    type NodeRef = { kind: "person" | "family"; id: string };
    type SourceRef = { kind: "person"; id: string } | { kind: "family"; id: string } | { kind: "empty" };

    type Props = {
        google_client_id: string;
        stemma_backend_url: string;
    };

    let { google_client_id, stemma_backend_url }: Props = $props();

    const e2eAutoLoginEnabled = typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1";
    const initialCached = e2eAutoLoginEnabled ? null : loadCredential();
    let signedIn = $state(e2eAutoLoginEnabled || initialCached !== null);

    type PendingAdd = { tempId: string; name: string };
    type PendingFamily = { tempId: string; parents: string[]; children: string[]; x?: number; y?: number };

    let editMode = $state(false);
    let panMode = $state(false);
    let spacePan = $state(false);
    const panActive = $derived(editMode && (panMode || spacePan));
    let pendingRemovedPersonIds = $state<Set<string>>(new Set());
    let pendingRemovedFamilyIds = $state<Set<string>>(new Set());
    let pendingAdds = $state<PendingAdd[]>([]);
    let pendingFamilies = $state<PendingFamily[]>([]);
    let trayOpen = $state(false);

    function isPendingId(id: string): boolean {
        return id.startsWith("pending-");
    }

    function isPendingPersonId(id: string): boolean {
        return id.startsWith("pending-") && !id.startsWith("pending-family-");
    }

    let ownedStemmas = $state<StemmaDescription[]>([]);
    let currentStemmaId = $state<string | null>(null);
    let stemma = $state<Stemma | null>(null);
    let stemmaIndex = $state<StemmaIndex | null>(null);
    let highlight = $state<HiglightLineages | null>(null);
    let pinnedPeople = $state<PinnedPeopleStorage | null>(null);
    let isWorking = $state<boolean>(false);
    let error = $state<Error | null>(null);
    let highlightVersion = $state(0);

    let selectedFamilyId = $state<string | null>(null);
    let selectedFamilyEl = $state<Element | null>(null);
    let familySheetOpen = $state(false);
    let dragTip = $state<{ text: string; x: number; y: number } | null>(null);
    let activeGestureSource = $state<SourceRef | null>(null);

    let personEditModal = $state<ReturnType<typeof V2PersonDetailsModal> | null>(null);
    let aboutModal = $state<ReturnType<typeof V2AboutModal> | null>(null);
    let settingsModal = $state<ReturnType<typeof V2SettingsModal> | null>(null);
    let shareAccessModal = $state<ReturnType<typeof V2ShareAccessModal> | null>(null);
    let promptModal = $state<ReturnType<typeof V2PromptModal> | null>(null);
    let confirmModal = $state<ReturnType<typeof V2ConfirmModal> | null>(null);
    let stemmaChart = $state<ReturnType<typeof FullStemma> | null>(null);

    const controller = new AppController(untrack(() => stemma_backend_url));

    let lastStemmaIdSeen: string | null = null;
    const subscriptions = [
        controller.currentStemmaId.subscribe((s) => (currentStemmaId = s)),
        controller.stemma.subscribe((s) => {
            const switchedStemma = currentStemmaId !== lastStemmaIdSeen;
            lastStemmaIdSeen = currentStemmaId;
            stemma = s;
            if (s === null || switchedStemma) {
                pendingRemovedPersonIds = new Set();
                pendingRemovedFamilyIds = new Set();
                pendingAdds = [];
                pendingFamilies = [];
            }
        }),
        controller.ownedStemmas.subscribe((os) => (ownedStemmas = os)),
        controller.stemmaIndex.subscribe((si) => (stemmaIndex = si)),
        controller.highlight.subscribe((hg) => (highlight = hg)),
        controller.pinnedStorage.subscribe((pp) => (pinnedPeople = pp)),
        controller.isWorking.subscribe((iw) => (isWorking = iw)),
        controller.err.subscribe((e) => (error = e)),
        controller.invitationToken.subscribe((tkn) => {
            if (!tkn) return;
            const link = buildInviteLink(window.location.origin, tkn);
            void navigator.clipboard?.writeText(link).catch(() => {});
            shareAccessModal?.dismiss();
        }),
    ];

    function pendingPersonDescription(p: PendingAdd): PersonDescription {
        return {
            type: "PersonDescription",
            id: p.tempId,
            name: p.name,
            birthDate: null,
            deathDate: null,
            bio: null,
            readOnly: true,
            photoUrl: null,
        };
    }

    const displayedStemma = $derived.by<Stemma | null>(() => {
        if (!stemma) return null;
        if (pendingAdds.length === 0 && pendingFamilies.length === 0) return stemma;
        return {
            ...stemma,
            people: [...stemma.people, ...pendingAdds.map(pendingPersonDescription)],
            families: [
                ...stemma.families,
                ...pendingFamilies.map((pf) => ({
                    type: "FamilyDescription" as const,
                    id: pf.tempId,
                    parents: pf.parents,
                    children: pf.children,
                    readOnly: true,
                })),
            ],
        };
    });

    const displayedStemmaIndex = $derived.by<StemmaIndex | null>(() => {
        if (!displayedStemma) return null;
        return new StemmaIndex(displayedStemma);
    });

    const orphanPeople = $derived.by<PersonDescription[]>(() => {
        if (!stemma || !stemmaIndex) return [];
        return stemma.people.filter((p) => stemmaIndex!.relatedFamilies(p.id).length === 0);
    });


    $effect(() => {
        if (!stemmaChart) return;
        void pendingRemovedPersonIds;
        void pendingRemovedFamilyIds;
        void pendingAdds;
        void pendingFamilies;
        queueMicrotask(applyPendingClasses);
    });

    function applyPendingClasses() {
        const svgEl = document.getElementById("chart");
        if (!svgEl) return;
        svgEl.querySelectorAll("circle.v2-pending-remove, circle.v2-pending-add").forEach((el) => {
            el.classList.remove("v2-pending-remove", "v2-pending-add");
        });
        const markCircle = (nodeId: string, cls: string) => {
            const el = document.getElementById(nodeId);
            const circle = el?.querySelector("circle");
            if (circle) circle.classList.add(cls);
        };
        pendingRemovedPersonIds.forEach((id) => markCircle(normalizeId("person", id), "v2-pending-remove"));
        pendingRemovedFamilyIds.forEach((id) => markCircle(normalizeId("family", id), "v2-pending-remove"));
        pendingAdds.forEach((p) => markCircle(normalizeId("person", p.tempId), "v2-pending-add"));
        pendingFamilies.forEach((p) => markCircle(normalizeId("family", p.tempId), "v2-pending-add"));
    }

    async function withPendingAdd(
        name: string,
        op: () => Promise<MutationResult>,
        pinAt?: { x: number; y: number },
        afterCommit?: (newPersonIds: string[]) => void,
    ): Promise<void> {
        const tempId = newPendingPersonId();
        pendingAdds = [...pendingAdds, { tempId, name }];
        if (pinAt) stemmaChart?.setNodePosition(normalizeId("person", tempId), pinAt.x, pinAt.y);
        try {
            const result = await op();
            if (pinAt) {
                result.newPersonIds.forEach((id) =>
                    stemmaChart?.setNodePosition(normalizeId("person", id), pinAt.x, pinAt.y),
                );
            }
            afterCommit?.(result.newPersonIds);
        } catch {
            // surfaced through controller.err
        } finally {
            pendingAdds = pendingAdds.filter((p) => p.tempId !== tempId);
        }
    }

    function newPendingPersonId(): string {
        return `pending-${crypto.randomUUID()}`;
    }

    function newPendingFamilyId(): string {
        return `pending-family-${crypto.randomUUID()}`;
    }

    function clientToSvgPoint(svgEl: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
        const pt = svgEl.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const mainG = svgEl.querySelector("g.main") as SVGGElement | null;
        const ctm = mainG?.getScreenCTM();
        if (!ctm) return { x: clientX, y: clientY };
        const out = pt.matrixTransform(ctm.inverse());
        return { x: out.x, y: out.y };
    }

    function nodeCenter(g: SVGGElement): { x: number; y: number } | null {
        const t = g.getAttribute("transform");
        if (!t) return null;
        const match = t.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
        if (!match) return null;
        return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
    }

    function findNodeUnder(x: number, y: number): { ref: NodeRef; el: SVGGElement } | null {
        const el = document.elementFromPoint(x, y);
        const g = el?.closest?.("g[id^='person_'], g[id^='family_']") as SVGGElement | null;
        if (!g) return null;
        const kind = g.id.startsWith("person_") ? "person" : "family";
        const id = denormalizeId(g.id);
        if (kind === "person" && isPendingPersonId(id)) return null;
        return { ref: { kind, id }, el: g };
    }

    function familyHasPerson(family: FamilyDescription, pid: string): boolean {
        return family.parents.includes(pid) || family.children.includes(pid);
    }

    function attachPersonToFamily(
        personId: string,
        familyId: string,
        role: "parent" | "child",
        pinAt?: { x: number; y: number },
    ) {
        if (!stemmaIndex) return;
        const family = stemmaIndex.family(familyId);
        if (!family) return;
        if (familyHasPerson(family, personId)) return;
        if (pinAt) {
            stemmaChart?.setNodePosition(normalizeId("person", personId), pinAt.x, pinAt.y);
        }
        const existingParents: PersonDefinition[] = family.parents.map((id) => ({ type: "ExistingPerson", id }));
        const existingChildren: PersonDefinition[] = family.children.map((id) => ({ type: "ExistingPerson", id }));
        const incoming: PersonDefinition = { type: "ExistingPerson", id: personId };
        const parents = role === "parent" ? [...existingParents, incoming] : existingParents;
        const children = role === "child" ? [...existingChildren, incoming] : existingChildren;
        controller.updateFamily(familyId, parents, children, { silent: true }).catch(() => {});
    }

    function createSpouseForPerson(
        existingPersonId: string,
        existingCenter: { x: number; y: number },
        title: string,
        dropAt: { x: number; y: number },
    ) {
        // Family marker goes at the midpoint between the existing person and the
        // drop point so it doesn't overlap the new spouse circle.
        const familyAt = { x: (existingCenter.x + dropAt.x) / 2, y: (existingCenter.y + dropAt.y) / 2 };
        personEditModal?.showCreatePerson({
            title,
            oncreate: ({ description, pin, photoUpload }) => {
                const tempPersonId = newPendingPersonId();
                const tempFamilyId = newPendingFamilyId();
                pendingAdds = [...pendingAdds, { tempId: tempPersonId, name: description.name }];
                pendingFamilies = [
                    ...pendingFamilies,
                    {
                        tempId: tempFamilyId,
                        parents: [existingPersonId, tempPersonId],
                        children: [],
                        x: familyAt.x,
                        y: familyAt.y,
                    },
                ];
                stemmaChart?.setNodePosition(normalizeId("person", tempPersonId), dropAt.x, dropAt.y);
                stemmaChart?.setNodePosition(normalizeId("family", tempFamilyId), familyAt.x, familyAt.y);
                const existingRef: PersonDefinition = { type: "ExistingPerson", id: existingPersonId };
                controller
                    .createFamily([existingRef, description], [], { silent: true })
                    .then((result) => {
                        const newPersonId = result.newPersonIds[0];
                        if (newPersonId) {
                            stemmaChart?.setNodePosition(normalizeId("person", newPersonId), dropAt.x, dropAt.y);
                            if (photoUpload || pin) {
                                controller.savePerson(newPersonId, description, pin, photoUpload, false);
                            }
                        }
                        result.newFamilyIds.forEach((id) =>
                            stemmaChart?.setNodePosition(normalizeId("family", id), familyAt.x, familyAt.y),
                        );
                    })
                    .catch(() => {})
                    .finally(() => {
                        pendingAdds = pendingAdds.filter((p) => p.tempId !== tempPersonId);
                        pendingFamilies = pendingFamilies.filter((p) => p.tempId !== tempFamilyId);
                    });
            },
        });
    }

    function createPersonInFamily(
        familyId: string,
        role: "parent" | "child",
        title: string,
        pinAt?: { x: number; y: number },
    ) {
        if (!stemmaIndex?.family(familyId)) return;
        personEditModal?.showCreatePerson({
            title,
            oncreate: ({ description, pin, photoUpload }) => {
                const family = stemmaIndex?.family(familyId);
                if (!family) return;
                const existingParents: PersonDefinition[] = family.parents.map((id) => ({ type: "ExistingPerson", id }));
                const existingChildren: PersonDefinition[] = family.children.map((id) => ({ type: "ExistingPerson", id }));
                const parents = role === "parent" ? [...existingParents, description] : existingParents;
                const children = role === "child" ? [...existingChildren, description] : existingChildren;
                void withPendingAdd(
                    description.name,
                    () => controller.updateFamily(familyId, parents, children, { silent: true }),
                    pinAt,
                    (newPersonIds) => {
                        const newId = newPersonIds[0];
                        if (newId && (photoUpload || pin)) {
                            controller.savePerson(newId, description, pin, photoUpload, false);
                        }
                    },
                );
            },
        });
    }

    // HTML5 DnD: tray chip → canvas family target. Tray person becomes spouse (parent).
    $effect(() => {
        if (!stemmaChart) return;
        const svgEl = document.getElementById("chart") as unknown as SVGSVGElement | null;
        if (!svgEl) return;

        const onDragOver = (e: DragEvent) => {
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes(PERSON_DRAG_MIME)) return;
            const g = (e.target as Element | null)?.closest?.("g[id^='family_']") as SVGGElement | null;
            if (!g) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "link";
            g.classList.add("v2-drop-target");
        };
        const onDragLeave = (e: DragEvent) => {
            const g = (e.target as Element | null)?.closest?.("g[id^='family_']") as SVGGElement | null;
            g?.classList.remove("v2-drop-target");
        };
        const onDrop = (e: DragEvent) => {
            const g = (e.target as Element | null)?.closest?.("g[id^='family_']") as SVGGElement | null;
            if (!g || !e.dataTransfer) return;
            const pid = e.dataTransfer.getData(PERSON_DRAG_MIME);
            const fid = denormalizeId(g.id);
            g.classList.remove("v2-drop-target");
            if (!pid || !fid) return;
            if (isPendingPersonId(pid)) return;
            e.preventDefault();
            const dropSvg = clientToSvgPoint(svgEl, e.clientX, e.clientY);
            attachPersonToFamily(pid, fid, "parent", dropSvg);
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
        if (!editMode || !stemmaChart) return;
        const svgEl = document.getElementById("chart") as unknown as SVGSVGElement | null;
        if (!svgEl) return;

        const PERSON_PREVIEW_R = 15;
        const FAMILY_PREVIEW_R = 7;

        let gesture: {
            source: SourceRef;
            sourceCenter: { x: number; y: number };
            startClientX: number;
            startClientY: number;
            active: boolean;
            sourceGEl: SVGGElement | null;
            sourceMarker: SVGCircleElement | null;
            line: SVGLineElement | null;
            endpointPreview: SVGCircleElement | null;
            lastTarget: SVGGElement | null;
        } | null = null;

        const clearTargetHighlight = () => {
            if (gesture?.lastTarget) gesture.lastTarget.classList.remove("v2-drop-target");
        };

        const removeSvgEl = (el: Element | null) => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        };

        const ensureArrowMarker = () => {
            if (svgEl.querySelector("defs > marker#v2-arrow")) return;
            let defs = svgEl.querySelector("defs") as SVGDefsElement | null;
            if (!defs) {
                defs = document.createElementNS(SVG_NS, "defs") as SVGDefsElement;
                svgEl.insertBefore(defs, svgEl.firstChild);
            }
            const marker = document.createElementNS(SVG_NS, "marker");
            marker.setAttribute("id", "v2-arrow");
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
            document.body.classList.remove("v2-linking");
            if (!gesture) return;
            clearTargetHighlight();
            removeSvgEl(gesture.line);
            removeSvgEl(gesture.sourceMarker);
            removeSvgEl(gesture.endpointPreview);
            gesture.sourceGEl?.classList.remove("v2-gesture-source");
            gesture = null;
            dragTip = null;
            activeGestureSource = null;
        };

        const targetCompatibility = (
            source: SourceRef,
            overInfo: { ref: NodeRef } | null,
        ): "valid" | "noop" | "create-empty" => {
            if (source.kind === "person") {
                if (overInfo?.ref.kind === "family") {
                    if (isPendingId(overInfo.ref.id)) return "valid";
                    const c = displayedStemmaIndex?.canAddParent(overInfo.ref.id, source.id);
                    return c?.ok ? "valid" : "noop";
                }
                if (!overInfo) return "create-empty";
                return "noop";
            }
            if (source.kind === "family") {
                if (overInfo?.ref.kind === "person") {
                    if (isPendingId(source.id)) return "valid";
                    const c = displayedStemmaIndex?.canAddChild(source.id, overInfo.ref.id);
                    return c?.ok ? "valid" : "noop";
                }
                if (!overInfo) return "create-empty";
                return "noop";
            }
            if (source.kind === "empty") {
                if (overInfo?.ref.kind === "family") return "valid";
                return "noop";
            }
            return "noop";
        };

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            if (panActive) return;
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
                stemmaChart?.popHover();
            } else {
                source = { kind: "empty" };
                center = clientToSvgPoint(svgEl, e.clientX, e.clientY);
            }
            gesture = {
                source,
                sourceCenter: center,
                startClientX: e.clientX,
                startClientY: e.clientY,
                active: false,
                sourceGEl,
                sourceMarker: null,
                line: null,
                endpointPreview: null,
                lastTarget: null,
            };
            // Apply linking cursor + selection lock immediately so that
            // browsers don't latch the I-beam from the initial mousedown
            // over an SVG text label for the rest of the drag.
            document.body.classList.add("v2-linking");
            // Prevent native text selection / drag of svg labels — selection
            // can hijack the gesture (mouseup replaced by dragend) and
            // visually litters the chart with highlighted text.
            e.preventDefault();
            e.stopImmediatePropagation();
        };

        const computeTipText = (overInfo: { ref: NodeRef } | null, source: SourceRef): string | null => {
            if (source.kind === "person") {
                if (!overInfo) return $t("v2.tipCreateSpouse");
                if (overInfo.ref.kind === "family") return $t("v2.tipAttachSpouse");
                return null;
            }
            if (source.kind === "family") {
                if (!overInfo) return $t("v2.tipCreateChild");
                if (overInfo.ref.kind === "person") return $t("v2.tipAttachChild");
                return null;
            }
            if (source.kind === "empty") {
                if (overInfo?.ref.kind === "family") return $t("v2.tipCreateSpouse");
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
            if (overInfo || gesture.source.kind === "empty") {
                if (gesture.endpointPreview) {
                    gesture.endpointPreview.style.display = "none";
                }
                return;
            }
            const previewKind = gesture.source.kind === "person" ? "family" : "person";
            const r = previewKind === "person" ? PERSON_PREVIEW_R : FAMILY_PREVIEW_R;
            if (!gesture.endpointPreview && mainG) {
                const p = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
                p.setAttribute("class", `v2-endpoint-preview v2-endpoint-${previewKind}`);
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

        const onMouseMove = (e: MouseEvent) => {
            if (!gesture) return;
            const dx = e.clientX - gesture.startClientX;
            const dy = e.clientY - gesture.startClientY;
            if (!gesture.active) {
                if (Math.hypot(dx, dy) <= 6) return;
                gesture.active = true;
                activeGestureSource = gesture.source;
                const mainG = svgEl.querySelector("g.main") as SVGGElement | null;
                if (mainG) {
                    ensureArrowMarker();
                    const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
                    line.setAttribute("class", "v2-link-line");
                    line.setAttribute("x1", String(gesture.sourceCenter.x));
                    line.setAttribute("y1", String(gesture.sourceCenter.y));
                    line.setAttribute("x2", String(gesture.sourceCenter.x));
                    line.setAttribute("y2", String(gesture.sourceCenter.y));
                    line.setAttribute("marker-end", "url(#v2-arrow)");
                    mainG.appendChild(line);
                    gesture.line = line;
                    if (gesture.source.kind === "empty") {
                        const marker = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
                        marker.setAttribute("class", "v2-empty-source-marker");
                        marker.setAttribute("cx", String(gesture.sourceCenter.x));
                        marker.setAttribute("cy", String(gesture.sourceCenter.y));
                        marker.setAttribute("r", "8");
                        mainG.appendChild(marker);
                        gesture.sourceMarker = marker;
                    }
                }
                gesture.sourceGEl?.classList.add("v2-gesture-source");
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
                gesture.lastTarget?.classList.remove("v2-drop-target");
                gesture.lastTarget = null;
                if (overG && compat === "valid") {
                    overG.classList.add("v2-drop-target");
                    gesture.lastTarget = overG;
                }
            }
            const mainG = svgEl.querySelector("g.main") as SVGGElement | null;
            updateEndpointPreview(mainG, svgPt, overInfo);
            const tipText = computeTipText(overInfo, gesture.source);
            dragTip = tipText ? { text: tipText, x: e.clientX, y: e.clientY } : null;
        };

        const onMouseUp = (e: MouseEvent) => {
            if (!gesture) return;
            const wasActive = gesture.active;
            const source = gesture.source;
            const startCenter = gesture.sourceCenter;
            const overInfo = findNodeUnder(e.clientX, e.clientY);
            cleanup();
            if (!wasActive) return;

            if (source.kind === "person" && overInfo?.ref.kind === "family") {
                attachPersonToFamily(source.id, overInfo.ref.id, "parent", startCenter);
                return;
            }
            if (source.kind === "family" && overInfo?.ref.kind === "person") {
                const tgtCenter = nodeCenter(overInfo.el) ?? undefined;
                attachPersonToFamily(overInfo.ref.id, source.id, "child", tgtCenter);
                return;
            }
            if (source.kind === "person" && !overInfo) {
                const releaseSvg = clientToSvgPoint(svgEl, e.clientX, e.clientY);
                createSpouseForPerson(source.id, startCenter, $t("v2.createSpouseTitle"), releaseSvg);
                return;
            }
            if (source.kind === "empty" && overInfo?.ref.kind === "family") {
                createPersonInFamily(overInfo.ref.id, "parent", $t("v2.createSpouseTitle"), startCenter);
                return;
            }
            if (source.kind === "family" && !overInfo && !isPendingId(source.id)) {
                const releaseSvg = clientToSvgPoint(svgEl, e.clientX, e.clientY);
                createPersonInFamily(source.id, "child", $t("v2.createChildTitle"), releaseSvg);
                return;
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") cleanup();
        };

        const onCancel = () => cleanup();
        // d3.drag attaches a pointerdown listener to each node g and restarts
        // the force simulation on press, which would scramble pinned positions
        // mid-gesture. Swallow pointerdown at the svg root in edit mode so the
        // d3 handler never sees it; V2's mousedown listener handles the gesture.
        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return;
            if (panActive) return;
            e.stopImmediatePropagation();
        };
        svgEl.addEventListener("pointerdown", onPointerDown, true);
        svgEl.addEventListener("mousedown", onMouseDown, true);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("contextmenu", onCancel);
        window.addEventListener("blur", onCancel);
        return () => {
            svgEl.removeEventListener("pointerdown", onPointerDown, true);
            svgEl.removeEventListener("mousedown", onMouseDown, true);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("contextmenu", onCancel);
            window.removeEventListener("blur", onCancel);
            cleanup();
        };
    });

    function classifyForDrop(src: SourceRef, g: Element): "v2-drop-allowed" | "v2-drop-disallowed" | null {
        const id = denormalizeId(g.id);
        const kind: "person" | "family" = g.id.startsWith("person_") ? "person" : "family";
        if (kind === "person" && isPendingPersonId(id)) return null;
        if (src.kind === "person") {
            if (kind !== "family") return null;
            if (isPendingId(id)) return "v2-drop-allowed";
            const c = displayedStemmaIndex?.canAddParent(id, src.id);
            if (!c) return null;
            return c.ok ? "v2-drop-allowed" : "v2-drop-disallowed";
        }
        if (src.kind === "family") {
            if (kind !== "person") return null;
            if (src.id === id) return null;
            if (isPendingId(src.id)) return "v2-drop-allowed";
            const c = displayedStemmaIndex?.canAddChild(src.id, id);
            if (!c) return null;
            return c.ok ? "v2-drop-allowed" : "v2-drop-disallowed";
        }
        return null;
    }

    $effect(() => {
        const src = activeGestureSource;
        if (!src || src.kind === "empty") return;
        void displayedStemmaIndex;
        void pendingFamilies;
        const svgEl = document.getElementById("chart");
        if (!svgEl) return;
        svgEl.querySelectorAll("g[id^='person_'], g[id^='family_']").forEach((g) => {
            g.classList.remove("v2-drop-allowed", "v2-drop-disallowed");
            const cls = classifyForDrop(src, g);
            if (cls) g.classList.add(cls);
        });
        return () => {
            svgEl.querySelectorAll("g.v2-drop-allowed, g.v2-drop-disallowed").forEach((g) => {
                g.classList.remove("v2-drop-allowed", "v2-drop-disallowed");
            });
        };
    });

    $effect(() => {
        if (!editMode) {
            panMode = false;
            spacePan = false;
        }
    });

    $effect(() => {
        if (!editMode) return;
        const isTypingTarget = (t: EventTarget | null): boolean => {
            if (!(t instanceof HTMLElement)) return false;
            const tag = t.tagName;
            return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (isTypingTarget(e.target)) return;
                if (panMode && !activeGestureSource && !document.querySelector(".v2-modal-panel")) {
                    panMode = false;
                }
                return;
            }
            if (e.code !== "Space" || e.repeat) return;
            if (isTypingTarget(e.target)) return;
            spacePan = true;
            e.preventDefault();
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code !== "Space") return;
            spacePan = false;
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            spacePan = false;
        };
    });

    $effect(() => {
        if (!panActive) {
            document.body.classList.remove("v2-pan-armed", "v2-pan-dragging");
            return;
        }
        document.body.classList.add("v2-pan-armed");
        const onDown = () => document.body.classList.add("v2-pan-dragging");
        const onUp = () => document.body.classList.remove("v2-pan-dragging");
        window.addEventListener("mousedown", onDown);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("mouseup", onUp);
            document.body.classList.remove("v2-pan-armed", "v2-pan-dragging");
        };
    });

    async function handleBulkAdd(names: string[]) {
        for (const name of names) {
            await withPendingAdd(name, () =>
                controller.createOrphanPerson({ type: "CreateNewPerson", name }, { silent: true }),
            );
        }
    }

    function errorMessage(err: Error): string {
        if (err instanceof LocalizedError) return $t(err.key, err.params);
        return err.message;
    }

    function handlePersonSelected(person: PersonDescription) {
        if (pendingRemovedPersonIds.has(person.id)) return;
        if (isPendingId(person.id)) return;
        personEditModal?.showPersonDetails({
            description: person,
            pin: pinnedPeople?.isPinned(person.id) ?? false,
        });
    }

    function handleFamilySelected(family: FamilyDescription) {
        if (pendingRemovedFamilyIds.has(family.id)) return;
        selectedFamilyEl = document.getElementById(normalizeId("family", family.id));
        selectedFamilyId = family.id;
        familySheetOpen = true;
    }

    function closeFamilySheet() {
        familySheetOpen = false;
        selectedFamilyId = null;
        selectedFamilyEl = null;
    }

    function setWith<T>(s: Set<T>, v: T): Set<T> {
        return s.has(v) ? s : new Set([...s, v]);
    }

    function setWithout<T>(s: Set<T>, v: T): Set<T> {
        if (!s.has(v)) return s;
        const next = new Set(s);
        next.delete(v);
        return next;
    }

    function runRemovePerson(personId: string) {
        pendingRemovedPersonIds = setWith(pendingRemovedPersonIds, personId);
        controller
            .removePerson(personId, { silent: true })
            .finally(() => { pendingRemovedPersonIds = setWithout(pendingRemovedPersonIds, personId); });
    }

    function runRemoveFamily(familyId: string) {
        pendingRemovedFamilyIds = setWith(pendingRemovedFamilyIds, familyId);
        controller
            .removeFamily(familyId, { silent: true })
            .finally(() => { pendingRemovedFamilyIds = setWithout(pendingRemovedFamilyIds, familyId); });
    }

    let currentToken = $state<string | null>(null);
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let inflightRefresh: Promise<string> | null = null;
    let e2eMode = false;

    function scheduleRefresh(expiresAt: number) {
        if (refreshTimer) clearTimeout(refreshTimer);
        if (e2eMode) return;
        refreshTimer = setTimeout(() => {
            void runRefresh();
        }, msUntilRefresh(expiresAt));
    }

    function adoptToken(token: string) {
        const saved = saveCredential(token);
        currentToken = token;
        if (saved) scheduleRefresh(saved.expiresAt);
    }

    function endSession() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = null;
        clearCredential();
        currentToken = null;
        signedIn = false;
    }

    function runRefresh(): Promise<string> {
        if (e2eMode) return Promise.resolve(currentToken!);
        if (inflightRefresh) return inflightRefresh;
        inflightRefresh = refreshCredential()
            .then((token) => {
                adoptToken(token);
                return token;
            })
            .catch((err) => {
                endSession();
                throw err;
            })
            .finally(() => {
                inflightRefresh = null;
            });
        return inflightRefresh;
    }

    const tokenProvider: TokenProvider = {
        getToken: () => currentToken,
        refresh: () => runRefresh(),
    };

    function handleSignIn(user: User) {
        adoptToken(user.id_token);
        controller.authenticateAndListStemmas(tokenProvider);
        signedIn = true;
    }

    function handleExportSvg() {
        const filename = $t("nav.exportDefaultName");
        stemmaChart?.exportSvg(filename);
    }

    function openAddStemma() {
        promptModal?.prompt({
            title: $t("stemma.addTitle"),
            label: $t("stemma.nameLabel"),
            confirmLabel: $t("common.add"),
            placeholder: $t("stemma.defaultName"),
            testid: "v2-add-stemma-modal",
            onaccept: (value) => controller.addStemma(value),
        });
    }

    function openRenameStemma(s: StemmaDescription) {
        promptModal?.prompt({
            title: $t("stemma.renameTitle"),
            label: $t("stemma.nameLabel"),
            confirmLabel: $t("stemma.rename"),
            initial: s.name,
            testid: "v2-rename-stemma-modal",
            onaccept: (value) => controller.renameStemma(s.id, value),
        });
    }

    function openCloneStemma(s: StemmaDescription) {
        promptModal?.prompt({
            title: $t("stemma.cloneTitle"),
            label: $t("stemma.nameLabel"),
            confirmLabel: $t("stemma.clone"),
            initial: s.name,
            testid: "v2-clone-stemma-modal",
            onaccept: (value) => controller.cloneStemma(value, s.id),
        });
    }

    function openAddPerson() {
        personEditModal?.showCreatePerson({
            title: $t("v2.addPerson"),
            oncreate: ({ description, pin, photoUpload }) => {
                void withPendingAdd(
                    description.name,
                    () => controller.createOrphanPerson(description, { silent: true }),
                    undefined,
                    (newPersonIds) => {
                        const newId = newPersonIds[0];
                        if (newId && (photoUpload || pin)) {
                            controller.savePerson(newId, description, pin, photoUpload, false);
                        }
                    },
                );
            },
        });
    }

    function openRemoveStemma(s: StemmaDescription) {
        confirmModal?.ask({
            title: $t("removeStemma.title", { name: s.name }),
            confirmLabel: $t("common.delete"),
            danger: true,
            testid: "v2-remove-stemma-modal",
            onaccept: () => controller.removeStemma(s.id),
        });
    }

    function handleFamilyRemoveRequested(familyId: string) {
        confirmModal?.ask({
            title: $t("v2.removeFamilyTitle"),
            message: $t("v2.removeFamilyMessage"),
            confirmLabel: $t("v2.dissolveFamilyConfirm"),
            danger: true,
            testid: "v2-remove-family-modal",
            onaccept: () => runRemoveFamily(familyId),
        });
    }

    function handlePersonRemoveRequested(payload: { id: string; name: string }) {
        confirmModal?.ask({
            title: $t("v2.removePersonTitle", { name: payload.name }),
            message: $t("v2.removePersonMessage"),
            confirmLabel: $t("common.delete"),
            danger: true,
            testid: "v2-remove-person-modal",
            onaccept: () => {
                runRemovePerson(payload.id);
                personEditModal?.dismiss();
            },
        });
    }

    onMount(() => {
        if (e2eAutoLoginEnabled) {
            e2eMode = true;
            const override = (window as unknown as { __STEMMA_E2E_USER__?: string }).__STEMMA_E2E_USER__;
            handleSignIn({ id_token: override || "e2e-user@stemma.local" } as User);
        } else {
            initializeGoogleAuth(google_client_id).catch((err) => console.error("Google Identity init failed", err));

            if (initialCached) {
                handleSignIn({ id_token: initialCached.token });
            } else {
                fetch(`${stemma_backend_url}/warmup`).catch(() => {});
            }
        }

        return () => {
            for (const unsub of subscriptions) unsub();
            if (refreshTimer) clearTimeout(refreshTimer);
        };
    });

    const showCanvas = $derived(!isWorking && displayedStemma && displayedStemmaIndex && highlight && pinnedPeople);
    const showEmpty = $derived(!isWorking && stemma && stemma.people.length === 0);
</script>

{#if signedIn}
    <div class="v2-layout" class:v2-edit-mode={editMode}>
        {#if editMode}
            <svg class="v2-edit-watermark" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="v2-edit-watermark-pattern" patternUnits="userSpaceOnUse" width="360" height="140" patternTransform="rotate(-25)">
                        <text x="0" y="60" fill="#212529" font-size="42" font-weight="800" letter-spacing="6">{$t("v2.editModeBanner")}</text>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#v2-edit-watermark-pattern)" />
            </svg>
        {/if}
        <div class="v2-canvas-layer">
            {#if showCanvas}
                <FullStemma
                    bind:this={stemmaChart}
                    hidden={isWorking}
                    stemma={displayedStemma!}
                    currentStemmaId={currentStemmaId ?? ""}
                    stemmaIndex={displayedStemmaIndex!}
                    highlight={highlight!}
                    pinnedPeople={pinnedPeople!}
                    viewMode={ViewMode.ALL}
                    simulationActive={!editMode}
                    onpersonSelected={handlePersonSelected}
                    onfamilySelected={handleFamilySelected}
                    onhighlightChanged={() => highlightVersion++}
                />
            {/if}

            {#if showEmpty}
                <V2EmptyState {editMode} onaddPerson={openAddPerson} />
            {/if}
        </div>

        <div class="v2-chrome" aria-hidden="false">
            <div class="v2-top-left">
                <V2Chip
                    {ownedStemmas}
                    {currentStemmaId}
                    disabled={isWorking}
                    onstemmaSelect={(id) => controller.selectStemma(id)}
                    onstemmaAddNew={openAddStemma}
                    onstemmaRename={openRenameStemma}
                    onstemmaClone={openCloneStemma}
                    onstemmaRemove={openRemoveStemma}
                />
            </div>

            <div class="v2-top-center">
                {#if stemma && stemma.people.length > 0}
                    <V2Search
                        people={stemma.people}
                        disabled={isWorking}
                        onselect={(id) => stemmaChart?.zoomToNode(id)}
                    />
                {/if}
            </div>

            <div class="v2-top-right">
                <V2LangSwitcher />
                <V2Menu
                    showSignOut={!e2eAutoLoginEnabled}
                    onabout={() => aboutModal?.show()}
                    onsettings={() => settingsModal?.show()}
                    onexport={handleExportSvg}
                    onsignOut={endSession}
                />
            </div>

            <div class="v2-bottom-right">
                <V2Fab
                    {editMode}
                    {panMode}
                    disabled={isWorking}
                    oneditToggle={() => { editMode = !editMode; }}
                    onpanToggle={() => { panMode = !panMode; }}
                    onaddPerson={openAddPerson}
                />
            </div>

            {#if !isWorking && stemma && stemmaIndex && highlight}
                <div class="v2-bottom-left">
                    <StatsCard {stemma} {stemmaIndex} {highlight} {highlightVersion} />
                </div>
            {/if}

            {#if editMode && stemma}
                <V2BulkAddTray
                    orphans={orphanPeople}
                    busy={isWorking}
                    open={trayOpen}
                    onbulkAdd={handleBulkAdd}
                    ontoggle={() => { trayOpen = !trayOpen; }}
                />
            {/if}
        </div>

        {#if isWorking}
            <div class="v2-loading">
                <Circle2 />
                <p class="mt-2">{$t("app.loading")}</p>
            </div>
        {/if}

        {#if dragTip}
            <div
                class="v2-drag-tip"
                style="left: {dragTip.x + 14}px; top: {dragTip.y + 14}px;"
                data-testid="v2-drag-tip"
            >
                {dragTip.text}
            </div>
        {/if}

        {#if error}
            <div class="v2-error-bar">
                <div class="alert alert-danger alert-dismissible fade show mb-0">
                    <button
                        type="button"
                        class="btn-close"
                        onclick={() => { error = null; }}
                        aria-label={$t("common.close")}
                    ></button>
                    <strong>{$t("app.oops")}</strong> {errorMessage(error)}
                </div>
            </div>
        {/if}
    </div>

    <V2Sheet
        open={familySheetOpen}
        anchorEl={selectedFamilyEl}
        onclose={closeFamilySheet}
        testid="v2-family-sheet"
    >
        {#snippet body()}
            <V2FamilyCard
                stemmaIndex={stemmaIndex}
                {editMode}
                familyId={selectedFamilyId}
                onfamilyRemoveRequested={handleFamilyRemoveRequested}
                onclose={closeFamilySheet}
            />
        {/snippet}
    </V2Sheet>

    <V2PersonDetailsModal
        bind:this={personEditModal}
        {editMode}
        onpersonUpdated={(p) => controller.savePerson(p.id, p.description, p.pin, p.photoUpload, p.photoRemove)}
        onpersonRemoveRequested={handlePersonRemoveRequested}
        onshareAccessRequested={(p) => shareAccessModal?.show(p)}
    />

    <V2AboutModal bind:this={aboutModal} />
    <V2SettingsModal bind:this={settingsModal} />
    <V2ShareAccessModal
        bind:this={shareAccessModal}
        oncreate={(p) => controller.createInvitationToken(p.personId, p.email)}
    />
    <V2PromptModal bind:this={promptModal} />
    <V2ConfirmModal bind:this={confirmModal} />
{:else}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Authenticate {google_client_id} onsignIn={(user) => handleSignIn(user)} />
        </div>
    </div>
{/if}

<style>
    :global(:root) {
        --v2-text-primary: #212529;
        --v2-text-secondary: #495057;
        --v2-text-muted: #6c757d;
        --v2-bg-surface: #fff;
        --v2-border-subtle: #f0f0f0;
        --v2-radius-modal: 16px;
        --v2-fs-title: 1rem;
        --v2-fs-body: 0.9rem;
        --v2-fs-label: 0.85rem;
        --v2-fs-hint: 0.8rem;
        --v2-fw-title: 700;
        --v2-fw-section: 600;
        --v2-fw-label: 500;
    }

    .v2-layout {
        position: relative;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background: #f8f9fa;
    }

    .v2-canvas-layer {
        position: absolute;
        inset: 0;
    }

    :global(.v2-canvas-layer #chart) {
        min-height: 100vh;
        padding: 0 !important;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
    }

    :global(.v2-canvas-layer #chart text) {
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
    }

    .v2-chrome {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .v2-top-left {
        position: absolute;
        top: 16px;
        left: 16px;
        pointer-events: auto;
        z-index: 110;
    }

    .v2-top-center {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        pointer-events: auto;
        z-index: 100;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    @media (max-width: 767.98px) {
        .v2-top-center {
            top: 72px;
        }
    }

    .v2-top-right {
        position: absolute;
        top: 16px;
        right: 16px;
        pointer-events: auto;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .v2-bottom-right {
        position: absolute;
        bottom: 24px;
        right: 20px;
        pointer-events: auto;
        z-index: 100;
    }

    .v2-bottom-left {
        position: absolute;
        bottom: 16px;
        left: 16px;
        pointer-events: auto;
        z-index: 100;
    }

    :global(.v2-bottom-left .stats-card) {
        position: static;
        bottom: auto;
        right: auto;
    }

    .v2-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        pointer-events: none;
        z-index: 200;
    }

    .v2-error-bar {
        position: absolute;
        top: 72px;
        left: 50%;
        transform: translateX(-50%);
        width: min(480px, calc(100vw - 32px));
        z-index: 300;
        pointer-events: auto;
    }

    .authenticate-bg {
        background-image: url("/assets/bg.webp");
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
    }

    .authenticate-holder {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
    }

    :global(.v2-pending-remove) {
        stroke-dasharray: 4 4;
        stroke: #dc3545;
        opacity: 0.45;
        animation: v2-pending-pulse 1.2s ease-in-out infinite;
    }

    :global(.v2-pending-add) {
        opacity: 0.45;
        stroke-dasharray: 4 3;
        stroke: #0d6efd;
        animation: v2-pending-pulse 1.2s ease-in-out infinite;
    }

    @keyframes v2-pending-pulse {
        0%, 100% { stroke-opacity: 1; }
        50% { stroke-opacity: 0.35; }
    }

    :global(g.v2-drop-disallowed) {
        opacity: 0.3;
        filter: saturate(0.2);
        pointer-events: none;
    }

    :global(g.v2-drop-allowed > circle) {
        animation: v2-drop-allowed-pulse 1.8s ease-in-out infinite;
    }

    @keyframes v2-drop-allowed-pulse {
        0%, 100% { stroke-opacity: 1; }
        50% { stroke-opacity: 0.45; }
    }

    :global(g.v2-drop-target > circle) {
        stroke: #0d6efd;
        stroke-width: 3px;
        stroke-dasharray: 4 2;
        filter: drop-shadow(0 0 6px rgba(13, 110, 253, 0.55));
    }

    :global(g.v2-gesture-source > circle) {
        stroke: #0d6efd;
        stroke-width: 2.5px;
        filter: drop-shadow(0 0 8px rgba(13, 110, 253, 0.65));
    }

    :global(.v2-empty-source-marker) {
        fill: rgba(13, 110, 253, 0.08);
        stroke: #0d6efd;
        stroke-width: 1.5;
        stroke-dasharray: 4 3;
        opacity: 0.7;
        pointer-events: none;
    }

    :global(.v2-endpoint-preview) {
        fill: rgba(13, 110, 253, 0.08);
        stroke: #0d6efd;
        stroke-width: 1.5;
        stroke-dasharray: 4 3;
        opacity: 0.75;
        pointer-events: none;
    }

    :global(.v2-link-line) {
        stroke: #0d6efd;
        stroke-width: 2px;
        stroke-dasharray: 5 4;
        pointer-events: none;
        opacity: 0.7;
    }

    :global(body.v2-linking),
    :global(body.v2-linking *) {
        cursor: crosshair !important;
        user-select: none !important;
        -webkit-user-select: none !important;
    }

    :global(body.v2-pan-armed),
    :global(body.v2-pan-armed *) {
        cursor: grab !important;
    }

    :global(body.v2-pan-dragging),
    :global(body.v2-pan-dragging *) {
        cursor: grabbing !important;
    }

    .v2-drag-tip {
        position: fixed;
        pointer-events: none;
        background: rgba(13, 110, 253, 0.95);
        color: #fff;
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 0.82rem;
        font-weight: 500;
        white-space: nowrap;
        z-index: 400;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }

    .v2-edit-mode :global(g[id^='person_']),
    .v2-edit-mode :global(g[id^='family_']) {
        cursor: grab;
    }

    .v2-edit-mode {
        box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.55);
        animation: v2-edit-mode-ring-pulse 2.4s ease-in-out infinite;
    }

    @keyframes v2-edit-mode-ring-pulse {
        0%, 100% { box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.55); }
        50% { box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.22); }
    }

    .v2-edit-watermark {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        opacity: 0.04;
    }

    .v2-edit-mode::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        opacity: 0.08;
        background-repeat: repeat;
        background-size: 220px 220px;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'><g fill='%23212529'><g transform='translate(30 40) rotate(20) scale(1.4)'><path d='M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325'/></g><g transform='translate(150 90) rotate(-35) scale(1.6)'><path d='M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325'/></g><g transform='translate(80 170) rotate(75) scale(1.3)'><path d='M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325'/></g></g></svg>");
    }
</style>
