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
    import V3Chip from "./components/V3Chip.svelte";
    import V3LangSwitcher from "./components/V3LangSwitcher.svelte";
    import V3Menu from "./components/V3Menu.svelte";
    import V3Fab from "./components/V3Fab.svelte";
    import V3Search from "./components/V3Search.svelte";
    import V3EmptyState from "./components/V3EmptyState.svelte";
    import V3Sheet from "./components/V3Sheet.svelte";
    import V3FamilyCard from "./components/V3FamilyCard.svelte";
    import V3BulkAddTray from "./components/V3BulkAddTray.svelte";
    import V3AboutModal from "./components/V3AboutModal.svelte";
    import V3SettingsModal from "./components/V3SettingsModal.svelte";
    import V3ShareAccessModal from "./components/V3ShareAccessModal.svelte";
    import V3PromptModal from "./components/V3PromptModal.svelte";
    import V3ConfirmModal from "./components/V3ConfirmModal.svelte";
    import V3PersonDetailsModal from "./components/V3PersonDetailsModal.svelte";
    import StatsCard from "../components/stats_card/StatsCard.svelte";
    import { buildInviteLink } from "../inviteLinkBuilder";
    import { Circle2 } from "svelte-loading-spinners";
    import * as d3 from "d3";
    import { denormalizeId, normalizeId } from "../graphTools";
    import { arrowPath, personR, familyR, labelFontSize } from "../graphStyles";
    import {
        focusedIdFromG,
        isShortTap,
        nearestNodeWithinRadius,
        MOUSE_LEAVE_DEBOUNCE_MS,
        FOCUS_RADIUS_SVG,
        type FocusedId,
    } from "./focusGesture";
    import { deriveGhostBranches, immediateNeighborIds, type GhostKind } from "./ghostHelpers";

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

    function isPendingFamilyId(id: string): boolean {
        return id.startsWith("pending-family-");
    }

    function isPendingPersonId(id: string): boolean {
        return isPendingId(id) && !isPendingFamilyId(id);
    }

    function findPendingFamily(id: string): PendingFamily | undefined {
        return pendingFamilies.find((f) => f.tempId === id);
    }

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
    let focusedId = $state<FocusedId | null>(null);
    /** Live SVG-space positions of all rendered ghost nodes (persons + families). Updated each sim tick. */
    let ghostSimPositions = $state<Array<{ x: number; y: number }>>([]);

    let personEditModal = $state<ReturnType<typeof V3PersonDetailsModal> | null>(null);
    let aboutModal = $state<ReturnType<typeof V3AboutModal> | null>(null);
    let settingsModal = $state<ReturnType<typeof V3SettingsModal> | null>(null);
    let shareAccessModal = $state<ReturnType<typeof V3ShareAccessModal> | null>(null);
    let promptModal = $state<ReturnType<typeof V3PromptModal> | null>(null);
    let confirmModal = $state<ReturnType<typeof V3ConfirmModal> | null>(null);
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
        svgEl.querySelectorAll("circle.v3-pending-remove, circle.v3-pending-add").forEach((el) => {
            el.classList.remove("v3-pending-remove", "v3-pending-add");
        });
        const markCircle = (nodeId: string, cls: string) => {
            const el = document.getElementById(nodeId);
            const circle = el?.querySelector("circle");
            if (circle) circle.classList.add(cls);
        };
        pendingRemovedPersonIds.forEach((id) => markCircle(normalizeId("person", id), "v3-pending-remove"));
        pendingRemovedFamilyIds.forEach((id) => markCircle(normalizeId("family", id), "v3-pending-remove"));
        pendingAdds.forEach((p) => markCircle(normalizeId("person", p.tempId), "v3-pending-add"));
        pendingFamilies.forEach((p) => markCircle(normalizeId("family", p.tempId), "v3-pending-add"));
    }

    async function withPendingAdd(
        name: string,
        op: () => Promise<MutationResult>,
        pinAt?: { x: number; y: number },
        afterCommit?: (result: MutationResult) => void,
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
            afterCommit?.(result);
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

    function createPendingFamilyForPerson(
        personId: string,
        role: "parent" | "child",
        familyAt: { x: number; y: number },
    ): PendingFamily {
        const tempId = newPendingFamilyId();
        const entry: PendingFamily = {
            tempId,
            parents: role === "parent" ? [personId] : [],
            children: role === "child" ? [personId] : [],
            x: familyAt.x,
            y: familyAt.y,
        };
        stemmaChart?.setNodePosition(normalizeId("family", tempId), familyAt.x, familyAt.y);
        pendingFamilies = [...pendingFamilies, entry];
        return entry;
    }

    function composeFamilyMembers(
        parentIds: string[],
        childIds: string[],
        incoming: PersonDefinition,
        role: "parent" | "child",
    ): { parents: PersonDefinition[]; children: PersonDefinition[] } {
        const parentDefs: PersonDefinition[] = parentIds.map((id) => ({ type: "ExistingPerson", id }));
        const childDefs: PersonDefinition[] = childIds.map((id) => ({ type: "ExistingPerson", id }));
        return {
            parents: role === "parent" ? [...parentDefs, incoming] : parentDefs,
            children: role === "child" ? [...childDefs, incoming] : childDefs,
        };
    }

    function promotePendingFamily(
        pending: PendingFamily,
        incoming: PersonDefinition,
        role: "parent" | "child",
    ): Promise<MutationResult> {
        const { parents, children } = composeFamilyMembers(pending.parents, pending.children, incoming, role);
        return controller.createFamily(parents, children, { silent: true });
    }

    function clearPendingFamily(tempId: string): void {
        pendingFamilies = pendingFamilies.filter((p) => p.tempId !== tempId);
    }

    function pinPromotedFamily(pending: PendingFamily, newFid: string | undefined): void {
        if (!newFid || pending.x === undefined || pending.y === undefined) return;
        stemmaChart?.setNodePosition(normalizeId("family", newFid), pending.x, pending.y);
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
        if (kind === "person" && isPendingId(id)) return null;
        return { ref: { kind, id }, el: g };
    }

    function familyHasPerson(family: { parents: string[]; children: string[] }, pid: string): boolean {
        return family.parents.includes(pid) || family.children.includes(pid);
    }

    function attachPersonToFamily(
        personId: string,
        familyId: string,
        role: "parent" | "child",
        pinAt?: { x: number; y: number },
    ) {
        const pending = findPendingFamily(familyId);
        if (pending) {
            if (familyHasPerson(pending, personId)) return;
            if (pinAt) {
                stemmaChart?.setNodePosition(normalizeId("person", personId), pinAt.x, pinAt.y);
            }
            const incoming: PersonDefinition = { type: "ExistingPerson", id: personId };
            promotePendingFamily(pending, incoming, role)
                .then((result) => {
                    clearPendingFamily(familyId);
                    pinPromotedFamily(pending, result.newFamilyIds[0]);
                })
                .catch(() => {});
            return;
        }
        if (!stemmaIndex) return;
        const family = stemmaIndex.family(familyId);
        if (!family) return;
        if (familyHasPerson(family, personId)) return;
        if (pinAt) {
            stemmaChart?.setNodePosition(normalizeId("person", personId), pinAt.x, pinAt.y);
        }
        const incoming: PersonDefinition = { type: "ExistingPerson", id: personId };
        const { parents, children } = composeFamilyMembers(family.parents, family.children, incoming, role);
        controller.updateFamily(familyId, parents, children, { silent: true }).catch(() => {});
    }

    function createPersonInFamily(
        familyId: string,
        role: "parent" | "child",
        title: string,
        pinAt?: { x: number; y: number },
    ) {
        const pending = findPendingFamily(familyId);
        if (!pending && !stemmaIndex?.family(familyId)) return;
        personEditModal?.showCreatePerson({
            title,
            oncreate: ({ description, pin, photoUpload }) => {
                if (pending) {
                    void withPendingAdd(
                        description.name,
                        () => promotePendingFamily(pending, description, role),
                        pinAt,
                        (result) => {
                            clearPendingFamily(familyId);
                            pinPromotedFamily(pending, result.newFamilyIds[0]);
                            const newId = result.newPersonIds[0];
                            if (newId && (photoUpload || pin)) {
                                controller.savePerson(newId, description, pin, photoUpload, false);
                            }
                        },
                    );
                    return;
                }
                const family = stemmaIndex?.family(familyId);
                if (!family) return;
                const { parents, children } = composeFamilyMembers(family.parents, family.children, description, role);
                void withPendingAdd(
                    description.name,
                    () => controller.updateFamily(familyId, parents, children, { silent: true }),
                    pinAt,
                    (result) => {
                        const newId = result.newPersonIds[0];
                        if (newId && (photoUpload || pin)) {
                            controller.savePerson(newId, description, pin, photoUpload, false);
                        }
                    },
                );
            },
        });
    }

    function onGhostClick(
        kind: GhostKind,
        focused: FocusedId | null,
        ghostPos: { x: number; y: number },
    ): void {
        if (!focused) return;

        if (kind === "child" && focused.kind === "family") {
            createPersonInFamily(focused.id, "child", $t("v3.addChild"), ghostPos);
            return;
        }

        if (kind === "child" && focused.kind === "person") {
            const personId = focused.id;
            personEditModal?.showCreatePerson({
                title: $t("v3.addChild"),
                oncreate: ({ description, pin, photoUpload }) => {
                    const pending = createPendingFamilyForPerson(personId, "parent", ghostPos);
                    void withPendingAdd(
                        description.name,
                        () => promotePendingFamily(pending, description, "child"),
                        ghostPos,
                        (result) => {
                            clearPendingFamily(pending.tempId);
                            pinPromotedFamily(pending, result.newFamilyIds[0]);
                            const newId = result.newPersonIds[0];
                            if (newId && (photoUpload || pin)) {
                                controller.savePerson(newId, description, pin, photoUpload, false);
                            }
                        },
                    );
                },
            });
            return;
        }

        if (kind === "spouse" && focused.kind === "person") {
            const personId = focused.id;
            personEditModal?.showCreatePerson({
                title: $t("v3.addAnotherSpouse"),
                oncreate: ({ description, pin, photoUpload }) => {
                    const pending = createPendingFamilyForPerson(personId, "parent", ghostPos);
                    void withPendingAdd(
                        description.name,
                        () => promotePendingFamily(pending, description, "parent"),
                        ghostPos,
                        (result) => {
                            clearPendingFamily(pending.tempId);
                            pinPromotedFamily(pending, result.newFamilyIds[0]);
                            const newId = result.newPersonIds[0];
                            if (newId && (photoUpload || pin)) {
                                controller.savePerson(newId, description, pin, photoUpload, false);
                            }
                        },
                    );
                },
            });
            return;
        }

        if (kind === "parent" && focused.kind === "person") {
            const personId = focused.id;
            personEditModal?.showCreatePerson({
                title: $t("v3.addParent"),
                oncreate: ({ description, pin, photoUpload }) => {
                    const pending = createPendingFamilyForPerson(personId, "child", ghostPos);
                    void withPendingAdd(
                        description.name,
                        () => promotePendingFamily(pending, description, "parent"),
                        ghostPos,
                        (result) => {
                            clearPendingFamily(pending.tempId);
                            pinPromotedFamily(pending, result.newFamilyIds[0]);
                            const newId = result.newPersonIds[0];
                            if (newId && (photoUpload || pin)) {
                                controller.savePerson(newId, description, pin, photoUpload, false);
                            }
                        },
                    );
                },
            });
        }
    }

    // Desktop mouse focus (edit mode only): distance-based hit detection on
    // mousemove.  Reads each real-node datum's (x, y) from the d3 simulation
    // and focuses the nearest node within FOCUS_RADIUS_SVG user-space units.
    // Uses the d3 zoom transform's scale (k) to convert the fixed SVG-space
    // radius into a screen-space equivalent so the check stays view-independent.
    $effect(() => {
        if (!editMode || !stemmaChart) return;
        const svgEl = document.getElementById("chart");
        if (!svgEl) return;

        let leaveTimer: ReturnType<typeof setTimeout> | null = null;

        const cancelLeave = () => {
            if (leaveTimer !== null) {
                clearTimeout(leaveTimer);
                leaveTimer = null;
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (e.buttons !== 0) return;
            const mainG = svgEl.querySelector("g.main") as SVGGElement | null;
            if (!mainG) return;
            const svgPt = clientToSvgPoint(svgEl as unknown as SVGSVGElement, e.clientX, e.clientY);
            const next = nearestNodeWithinRadius(mainG, svgPt.x, svgPt.y, FOCUS_RADIUS_SVG, isPendingId);
            if (!next) {
                const nearGhost = ghostSimPositions.some(
                    (p) => Math.hypot(p.x - svgPt.x, p.y - svgPt.y) <= FOCUS_RADIUS_SVG,
                );
                if (nearGhost) {
                    cancelLeave();
                    return;
                }
                if (focusedId !== null && leaveTimer === null) {
                    leaveTimer = setTimeout(() => {
                        leaveTimer = null;
                        focusedId = null;
                    }, MOUSE_LEAVE_DEBOUNCE_MS);
                }
                return;
            }
            cancelLeave();
            if (focusedId?.id !== next.id || focusedId?.kind !== next.kind) {
                focusedId = next;
            }
        };

        const onMouseLeave = (_e: MouseEvent) => {
            cancelLeave();
            leaveTimer = setTimeout(() => {
                leaveTimer = null;
                focusedId = null;
            }, MOUSE_LEAVE_DEBOUNCE_MS);
        };

        svgEl.addEventListener("mousemove", onMouseMove);
        svgEl.addEventListener("mouseleave", onMouseLeave);
        return () => {
            cancelLeave();
            svgEl.removeEventListener("mousemove", onMouseMove);
            svgEl.removeEventListener("mouseleave", onMouseLeave);
        };
    });

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

    // Ghost nodes: render dashed affordance placeholders and run a d3 force
    // simulation so they settle in empty space without overlapping real nodes.
    // Each focused-person branch renders an intermediate ghost family node and
    // an endpoint ghost person node.  Focused-family branches render only a
    // ghost person (the family already exists).
    $effect(() => {
        // Read stemmaChart first so Svelte tracks it as a reactive dependency.
        // Without this, the effect exits early on first mount (before the SVG
        // is in the DOM) without ever reading focusedId/stemmaIndex, and those
        // deps are never tracked — so a later mousemove that sets focusedId
        // never re-triggers this effect.
        if (!stemmaChart) return;
        const svgEl = document.getElementById("chart") as unknown as SVGSVGElement | null;
        const mainG = svgEl?.querySelector("g.main") as SVGGElement | null;
        if (!svgEl || !mainG) return;

        // Snapshot every real node position before any freeze decision.
        // Keys are the d3 datum ids (same as normalizeId output).
        type Snapshot = { x: number; y: number };
        const positionSnapshot = new Map<string, Snapshot>();
        d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
            if (d && d.x != null && d.y != null) {
                positionSnapshot.set(d.id, { x: d.x, y: d.y });
            }
        });

        // Determine which nodes are immediate neighbors of the focused node.
        // Neighbors participate in the ghost sim unfrozen so ghosts can push them.
        // All other real nodes are frozen. The focused node itself is always frozen.
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

        // Collect real-node sim entries. Neighbors are unfrozen (no fx/fy) so
        // the ghost collision force can push them. Frozen nodes have fx/fy set.
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
        // Keep a parallel map from dom-id → original d3 datum for neighbors so
        // we can sync the ghost-sim positions back to the main sim's data objects.
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

        // All DOM elements created for ghost nodes (for fade-out on teardown).
        const allGhostEls: Element[] = [];

        // Per-branch sim nodes for the d3 sim tick updates.
        type BranchSimEntry = {
            familySimNode: SimNode | null;
            personSimNode: SimNode;
            familyEl: SVGGElement | null;
            personEl: SVGGElement;
            edgeFocusToFamily: SVGLineElement | null;
            edgeFamilyToPerson: SVGLineElement | null;
            kind: GhostKind;
        };
        const branchEntries: BranchSimEntry[] = [];

        const makeLine = (x1: number, y1: number, x2: number, y2: number): SVGLineElement => {
            const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
            line.setAttribute("class", "v3-ghost-edge");
            line.setAttribute("x1", String(x1));
            line.setAttribute("y1", String(y1));
            line.setAttribute("x2", String(x2));
            line.setAttribute("y2", String(y2));
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

        for (const branch of branches) {
            const personSeedX = origin ? origin.x + branch.personDx : branch.personDx;
            const personSeedY = origin ? origin.y + branch.personDy : branch.personDy;

            const capturedFocusedId = focusedId;
            const capturedKind = branch.kind;

            if (branch.familyId !== null) {
                const familySeedX = origin ? origin.x + branch.familyDx : branch.familyDx;
                const familySeedY = origin ? origin.y + branch.familyDy : branch.familyDy;

                const edgeFocusToFamily = origin
                    ? makeLine(origin.x, origin.y, familySeedX, familySeedY)
                    : null;
                const edgeFamilyToPerson = makeLine(familySeedX, familySeedY, personSeedX, personSeedY);

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

                branchEntries.push({
                    familySimNode,
                    personSimNode,
                    familyEl,
                    personEl,
                    edgeFocusToFamily,
                    edgeFamilyToPerson,
                    kind: capturedKind,
                });

                personEl.addEventListener("pointerup", (e: PointerEvent) => {
                    e.stopPropagation();
                    const ghostPos = { x: personSimNode.x, y: personSimNode.y };
                    onGhostClick(capturedKind, capturedFocusedId, ghostPos);
                });
            } else {
                const edgeFocusToPerson = origin
                    ? makeLine(origin.x, origin.y, personSeedX, personSeedY)
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

                branchEntries.push({
                    familySimNode: null,
                    personSimNode,
                    familyEl: null,
                    personEl,
                    edgeFocusToFamily: edgeFocusToPerson,
                    edgeFamilyToPerson: null,
                    kind: capturedKind,
                });

                personEl.addEventListener("pointerup", (e: PointerEvent) => {
                    e.stopPropagation();
                    const ghostPos = { x: personSimNode.x, y: personSimNode.y };
                    onGhostClick(capturedKind, capturedFocusedId, ghostPos);
                });
            }
        }

        // Trigger fade-in: after the browser has painted the initial opacity:0
        // state, remove the inline style so the CSS rule (opacity: 0.6) applies
        // via the CSS transition. The cancelled flag prevents the RAF from
        // fighting the fade-out if teardown runs before the first frame.
        let fadeInCancelled = false;
        requestAnimationFrame(() => {
            if (fadeInCancelled) return;
            for (const el of allGhostEls) {
                (el as SVGElement).style.opacity = "";
            }
        });

        // Run a separate simulation: real nodes (pinned) + ghost nodes (free).
        // Forces: collision keeps ghosts from overlapping any node; forceX/forceY
        // with low strength (0.15) anchor each ghost near its seed position so it
        // doesn't drift to infinity.
        const GHOST_RADIUS = 32;
        const ghostSimNodes = branchEntries.flatMap((e) =>
            e.familySimNode ? [e.familySimNode, e.personSimNode] : [e.personSimNode],
        );
        const allSimNodes = [...realSimNodes, ...ghostSimNodes];

        const ghostSim = d3
            .forceSimulation<SimNode>(allSimNodes)
            .force("collide", d3.forceCollide<SimNode>().radius(GHOST_RADIUS).strength(0.8))
            .force("seedX", d3.forceX<SimNode>((n) => n.seedX).strength((n) => (n.isGhost ? 0.15 : 0)))
            .force("seedY", d3.forceY<SimNode>((n) => n.seedY).strength((n) => (n.isGhost ? 0.15 : 0)))
            .alphaDecay(0.02)
            .velocityDecay(0.6);

        // Build a lookup from dom-id → ghost-sim node for neighbor updates in the tick.
        const neighborSimNodeById = new Map<string, SimNode>();
        for (const n of realSimNodes) {
            if (neighborDomIds.has(n.id)) {
                neighborSimNodeById.set(n.id, n);
            }
        }

        ghostSim.on("tick", () => {
            // Propagate neighbor positions to the DOM and back to the main sim datum.
            for (const [domId, simNode] of neighborSimNodeById) {
                const gEl = mainG.querySelector(`#${CSS.escape(domId)}`) as SVGGElement | null;
                if (gEl) {
                    gEl.setAttribute("transform", `translate(${simNode.x},${simNode.y})`);
                }
                // Sync position to the d3 datum so the main sim picks it up after blur.
                const datum = neighborDatumById.get(domId);
                if (datum) {
                    datum.x = simNode.x;
                    datum.y = simNode.y;
                }
            }

            const nextPositions: Array<{ x: number; y: number }> = [];
            for (const entry of branchEntries) {
                const { familySimNode, personSimNode, familyEl, personEl, edgeFocusToFamily, edgeFamilyToPerson } = entry;

                personEl.setAttribute("transform", `translate(${personSimNode.x},${personSimNode.y})`);
                nextPositions.push({ x: personSimNode.x, y: personSimNode.y });

                if (familySimNode && familyEl) {
                    familyEl.setAttribute("transform", `translate(${familySimNode.x},${familySimNode.y})`);
                    nextPositions.push({ x: familySimNode.x, y: familySimNode.y });
                    if (edgeFocusToFamily && origin) {
                        edgeFocusToFamily.setAttribute("x2", String(familySimNode.x));
                        edgeFocusToFamily.setAttribute("y2", String(familySimNode.y));
                    }
                    if (edgeFamilyToPerson) {
                        edgeFamilyToPerson.setAttribute("x1", String(familySimNode.x));
                        edgeFamilyToPerson.setAttribute("y1", String(familySimNode.y));
                        edgeFamilyToPerson.setAttribute("x2", String(personSimNode.x));
                        edgeFamilyToPerson.setAttribute("y2", String(personSimNode.y));
                    }
                } else if (edgeFocusToFamily && origin) {
                    edgeFocusToFamily.setAttribute("x2", String(personSimNode.x));
                    edgeFocusToFamily.setAttribute("y2", String(personSimNode.y));
                }
            }
            ghostSimPositions = nextPositions;
        });

        return () => {
            fadeInCancelled = true;
            ghostSim.stop();
            ghostSimPositions = [];
            fadeOutAndRemove(allGhostEls);

            // Snap freed neighbors back to their pre-focus positions, then
            // release them so the main sim can resume.  Strategy: pin each
            // drifted neighbor at its snapshot coordinates for one sim tick
            // (~250 ms transition via CSS on the SVG transform), then clear
            // fx/fy.  This gives a visually elastic spring-back.
            const SNAP_BACK_MS = 250;
            d3.select("g.main").selectAll<SVGGElement, any>("g").each((d: any) => {
                if (!d) return;
                const snap = positionSnapshot.get(d.id);
                if (neighborDomIds.has(d.id) && snap) {
                    d.fx = snap.x;
                    d.fy = snap.y;
                    const gEl = mainG.querySelector(`#${CSS.escape(d.id)}`) as SVGGElement | null;
                    if (gEl) {
                        gEl.style.transition = `transform ${SNAP_BACK_MS}ms ease-out`;
                        gEl.setAttribute("transform", `translate(${snap.x},${snap.y})`);
                    }
                    setTimeout(() => {
                        d.x = snap.x;
                        d.y = snap.y;
                        d.fx = null;
                        d.fy = null;
                        if (gEl) gEl.style.transition = "";
                    }, SNAP_BACK_MS);
                } else {
                    d.fx = null;
                    d.fy = null;
                }
            });
        };
    });

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
            activeGestureSource = null;
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
                activeGestureSource = gesture.source;
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
                // Short tap on touch: set or clear focus.
                if (e.pointerType !== "mouse" && isShortTap(elapsed, moved)) {
                    if (sourceGEl) {
                        focusedId = focusedIdFromG(sourceGEl, isPendingId);
                    } else {
                        focusedId = null;
                    }
                }
                return;
            }

            if (source.kind === "person" && overInfo?.ref.kind === "family") {
                attachPersonToFamily(source.id, overInfo.ref.id, "parent", startCenter);
                return;
            }
            if (source.kind === "family" && overInfo?.ref.kind === "person") {
                const tgtCenter = nodeCenter(overInfo.el) ?? undefined;
                attachPersonToFamily(overInfo.ref.id, source.id, "child", tgtCenter);
                return;
            }
            if (source.kind === "empty" && overInfo?.ref.kind === "family") {
                const anchor = familyAnchor(overInfo.ref.id);
                const title = anchor.via === "parents"
                    ? $t("v2.createSpouseTitleOf", { name: joinNames(anchor.names) })
                    : $t("v2.createParentTitleOf", { names: joinNames(anchor.names) });
                createPersonInFamily(overInfo.ref.id, "parent", title, startCenter);
                return;
            }
            if (source.kind === "family" && !overInfo) {
                const releaseSvg = clientToSvgPoint(svgEl, e.clientX, e.clientY);
                const title = $t("v2.createChildTitleOf", { names: joinNames(familyParentNames(source.id)) });
                createPersonInFamily(source.id, "child", title, releaseSvg);
                return;
            }
            if (source.kind === "person" && !overInfo) {
                const releaseSvg = clientToSvgPoint(svgEl, e.clientX, e.clientY);
                createPendingFamilyForPerson(source.id, "parent", releaseSvg);
                return;
            }
            if (source.kind === "empty" && overInfo?.ref.kind === "person") {
                if (displayedStemmaIndex?.hasParentFamily(overInfo.ref.id)) return;
                createPendingFamilyForPerson(overInfo.ref.id, "child", startCenter);
                return;
            }
        };

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                cleanup();
                focusedId = null;
            }
        };

        const onCancel = () => cleanup();
        // d3.drag attaches a pointerdown listener to each node g and restarts
        // the force simulation on press, which would scramble pinned positions
        // mid-gesture. Capturing pointerdown at the svg root and stopping
        // propagation prevents the d3 handler from ever seeing it, and the
        // same handler starts V3's linking gesture. Single path covers mouse,
        // pen, and touch.
        const onPointerDownCapture = (e: PointerEvent) => {
            if (panActive) return;
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.stopImmediatePropagation();
            onPointerStart(e);
        };
        // touchstart fires before pointerdown, so d3.zoom would start a pan in parallel
        // with the link gesture; swallow single-finger touch, let pinch through.
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

    $effect(() => {
        if (editMode) return;
        panMode = false;
        spacePan = false;
        untrack(() => {
            const filtered = pendingFamilies.filter((p) => p.parents.length + p.children.length >= 2);
            if (filtered.length !== pendingFamilies.length) pendingFamilies = filtered;
        });
    });

    // Pan activation (edit mode Space/pan button) clears focus so ghosts are
    // dismissed before the user starts dragging the canvas.
    $effect(() => {
        if (panActive) focusedId = null;
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
                if (panMode && !activeGestureSource && !document.querySelector(".v3-modal-panel")) {
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
            testid: "v3-add-stemma-modal",
            onaccept: (value) => controller.addStemma(value),
        });
    }

    function openRenameStemma(s: StemmaDescription) {
        promptModal?.prompt({
            title: $t("stemma.renameTitle"),
            label: $t("stemma.nameLabel"),
            confirmLabel: $t("stemma.rename"),
            initial: s.name,
            testid: "v3-rename-stemma-modal",
            onaccept: (value) => controller.renameStemma(s.id, value),
        });
    }

    function openCloneStemma(s: StemmaDescription) {
        promptModal?.prompt({
            title: $t("stemma.cloneTitle"),
            label: $t("stemma.nameLabel"),
            confirmLabel: $t("stemma.clone"),
            initial: s.name,
            testid: "v3-clone-stemma-modal",
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
                    (result) => {
                        const newId = result.newPersonIds[0];
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
            testid: "v3-remove-stemma-modal",
            onaccept: () => controller.removeStemma(s.id),
        });
    }

    function handleFamilyRemoveRequested(familyId: string) {
        confirmModal?.ask({
            title: $t("v2.removeFamilyTitle"),
            message: $t("v2.removeFamilyMessage"),
            confirmLabel: $t("v2.dissolveFamilyConfirm"),
            danger: true,
            testid: "v3-remove-family-modal",
            onaccept: () => runRemoveFamily(familyId),
        });
    }

    function handlePersonRemoveRequested(payload: { id: string; name: string }) {
        confirmModal?.ask({
            title: $t("v2.removePersonTitle", { name: payload.name }),
            message: $t("v2.removePersonMessage"),
            confirmLabel: $t("common.delete"),
            danger: true,
            testid: "v3-remove-person-modal",
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
    <div class="v3-layout" class:v3-edit-mode={editMode}>
        {#if editMode}
            <svg class="v3-edit-watermark" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="v3-edit-watermark-pattern" patternUnits="userSpaceOnUse" width="360" height="140" patternTransform="rotate(-25)">
                        <text x="0" y="60" fill="#212529" font-size="42" font-weight="800" letter-spacing="6">{$t("v2.editModeBanner")}</text>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#v3-edit-watermark-pattern)" />
            </svg>
        {/if}
        <div class="v3-canvas-layer">
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
                <V3EmptyState {editMode} onaddPerson={openAddPerson} />
            {/if}
        </div>

        <div class="v3-chrome" aria-hidden="false">
            <div class="v3-top-left">
                <V3Chip
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

            <div class="v3-top-center">
                {#if stemma && stemma.people.length > 0}
                    <V3Search
                        people={stemma.people}
                        disabled={isWorking}
                        onselect={(id) => stemmaChart?.zoomToNode(id)}
                    />
                {/if}
            </div>

            <div class="v3-top-right">
                <V3LangSwitcher />
                <V3Menu
                    showSignOut={!e2eAutoLoginEnabled}
                    onabout={() => aboutModal?.show()}
                    onsettings={() => settingsModal?.show()}
                    onexport={handleExportSvg}
                    onsignOut={endSession}
                />
            </div>

            <div class="v3-bottom-right">
                <V3Fab
                    {editMode}
                    {panMode}
                    disabled={isWorking}
                    oneditToggle={() => { editMode = !editMode; }}
                    onpanToggle={() => { panMode = !panMode; }}
                    onaddPerson={openAddPerson}
                />
            </div>

            {#if !isWorking && stemma && stemmaIndex && highlight}
                <div class="v3-bottom-left">
                    <StatsCard {stemma} {stemmaIndex} {highlight} {highlightVersion} />
                </div>
            {/if}

            {#if editMode && stemma}
                <V3BulkAddTray
                    orphans={orphanPeople}
                    busy={isWorking}
                    open={trayOpen}
                    onbulkAdd={handleBulkAdd}
                    ontoggle={() => { trayOpen = !trayOpen; }}
                />
            {/if}
        </div>

        {#if isWorking}
            <div class="v3-loading">
                <Circle2 />
                <p class="mt-2">{$t("app.loading")}</p>
            </div>
        {/if}

        {#if dragTip}
            <div
                class="v3-drag-tip"
                style="left: {dragTip.x + 14}px; top: {dragTip.y + 14}px;"
                data-testid="v3-drag-tip"
            >
                {dragTip.text}
            </div>
        {/if}

        {#if error}
            <div class="v3-error-bar">
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

    <V3Sheet
        open={familySheetOpen}
        anchorEl={selectedFamilyEl}
        onclose={closeFamilySheet}
        testid="v3-family-sheet"
    >
        {#snippet body()}
            <V3FamilyCard
                stemmaIndex={stemmaIndex}
                {editMode}
                familyId={selectedFamilyId}
                onfamilyRemoveRequested={handleFamilyRemoveRequested}
                onclose={closeFamilySheet}
            />
        {/snippet}
    </V3Sheet>

    <V3PersonDetailsModal
        bind:this={personEditModal}
        {editMode}
        onpersonUpdated={(p) => controller.savePerson(p.id, p.description, p.pin, p.photoUpload, p.photoRemove)}
        onpersonRemoveRequested={handlePersonRemoveRequested}
        onshareAccessRequested={(p) => shareAccessModal?.show(p)}
    />

    <V3AboutModal bind:this={aboutModal} />
    <V3SettingsModal bind:this={settingsModal} />
    <V3ShareAccessModal
        bind:this={shareAccessModal}
        oncreate={(p) => controller.createInvitationToken(p.personId, p.email)}
    />
    <V3PromptModal bind:this={promptModal} />
    <V3ConfirmModal bind:this={confirmModal} />
{:else}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Authenticate {google_client_id} onsignIn={(user) => handleSignIn(user)} />
        </div>
    </div>
{/if}

<style>
    :global(:root) {
        --v3-text-primary: #212529;
        --v3-text-secondary: #495057;
        --v3-text-muted: #6c757d;
        --v3-bg-surface: #fff;
        --v3-border-subtle: #f0f0f0;
        --v3-radius-modal: 16px;
        --v3-fs-title: 1rem;
        --v3-fs-body: 0.9rem;
        --v3-fs-label: 0.85rem;
        --v3-fs-hint: 0.8rem;
        --v3-fw-title: 700;
        --v3-fw-section: 600;
        --v3-fw-label: 500;
    }

    .v3-layout {
        position: relative;
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        background: #f8f9fa;
    }

    .v3-canvas-layer {
        position: absolute;
        inset: 0;
    }

    :global(.v3-canvas-layer #chart) {
        min-height: 100vh;
        min-height: 100dvh;
        padding: 0 !important;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
    }

    :global(.v3-edit-mode .v3-canvas-layer #chart) {
        touch-action: none;
    }

    :global(.v3-canvas-layer #chart text) {
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
    }

    .v3-chrome {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .v3-top-left {
        position: absolute;
        top: 16px;
        left: 16px;
        pointer-events: auto;
        z-index: 110;
    }

    .v3-top-center {
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
        .v3-top-center {
            top: 72px;
        }
    }

    .v3-top-right {
        position: absolute;
        top: 16px;
        right: 16px;
        pointer-events: auto;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .v3-bottom-right {
        position: absolute;
        bottom: calc(24px + env(safe-area-inset-bottom, 0px));
        right: calc(20px + env(safe-area-inset-right, 0px));
        pointer-events: auto;
        z-index: 100;
    }

    .v3-bottom-left {
        position: absolute;
        bottom: calc(16px + env(safe-area-inset-bottom, 0px));
        left: calc(16px + env(safe-area-inset-left, 0px));
        pointer-events: auto;
        z-index: 100;
    }

    :global(.v3-bottom-left .stats-card) {
        position: static;
        bottom: auto;
        right: auto;
    }

    .v3-loading {
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

    .v3-error-bar {
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

    :global(g.v3-ghost) {
        opacity: 0.6;
        cursor: default;
        transition: opacity 200ms ease;
    }

    :global(g.v3-ghost > circle) {
        fill: none;
        stroke: #6c757d;
        stroke-width: 1.5px;
        stroke-dasharray: 5 3;
        pointer-events: none;
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

    :global(.v3-pending-remove) {
        stroke-dasharray: 4 4;
        stroke: #dc3545;
        opacity: 0.45;
        animation: v3-pending-pulse 1.2s ease-in-out infinite;
    }

    :global(.v3-pending-add) {
        opacity: 0.45;
        stroke-dasharray: 4 3;
        stroke: #0d6efd;
        animation: v3-pending-pulse 1.2s ease-in-out infinite;
    }

    @keyframes v3-pending-pulse {
        0%, 100% { stroke-opacity: 1; }
        50% { stroke-opacity: 0.35; }
    }

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

    .v3-edit-mode :global(g[id^='person_']),
    .v3-edit-mode :global(g[id^='family_']) {
        cursor: grab;
    }

    .v3-edit-mode {
        box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.55);
        animation: v3-edit-mode-ring-pulse 2.4s ease-in-out infinite;
    }

    @keyframes v3-edit-mode-ring-pulse {
        0%, 100% { box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.55); }
        50% { box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.22); }
    }

    .v3-edit-watermark {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        opacity: 0.04;
    }

    .v3-edit-mode::before {
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
