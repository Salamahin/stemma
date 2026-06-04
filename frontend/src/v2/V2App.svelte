<script lang="ts">
    import { onMount, tick, untrack } from "svelte";
    import { AppController } from "../appController";
    import type { Stemma, FamilyDescription, PersonDescription, StemmaDescription, User, TokenProvider, CreateNewPerson } from "../model";
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
    import V2EditPill from "./components/V2EditPill.svelte";
    import V2Search from "./components/V2Search.svelte";
    import V2EmptyState from "./components/V2EmptyState.svelte";
    import V2Sheet from "./components/V2Sheet.svelte";
    import V2FamilyCard from "./components/V2FamilyCard.svelte";
    import V2PersonGhost from "./components/V2PersonGhost.svelte";
    import V2FamilyGhost from "./components/V2FamilyGhost.svelte";
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
    import {
        buildStubPayload,
        canAddParentToFamily,
        type FamilyFromStubPayload,
        type GhostFamilyAction,
        type PersonArg,
    } from "./ghostHelpers";

    type StubEntry = { anchorPersonId: string; anchorRole: "parent" | "child" };

    type GhostPopoverState =
        | { kind: "personRole"; anchorEl: Element; personId: string }
        | { kind: "familyAdd"; anchorEl: Element; familyId: string; action: GhostFamilyAction };

    type Props = {
        google_client_id: string;
        stemma_backend_url: string;
    };

    let { google_client_id, stemma_backend_url }: Props = $props();

    const e2eAutoLoginEnabled = typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1";
    const initialCached = e2eAutoLoginEnabled ? null : loadCredential();
    let signedIn = $state(e2eAutoLoginEnabled || initialCached !== null);

    let editMode = $state(false);
    let stubFamilies = $state<Map<string, StubEntry>>(new Map());
    let pendingRemovedPersonIds = $state<Set<string>>(new Set());
    let pendingRemovedFamilyIds = $state<Set<string>>(new Set());

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
    let ghostPopover = $state<GhostPopoverState | null>(null);

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
                stubFamilies = new Map();
                pendingRemovedPersonIds = new Set();
                pendingRemovedFamilyIds = new Set();
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

    const augmentedStemma = $derived.by<Stemma | null>(() => {
        if (!stemma) return null;
        const stubFamilyDescriptions: FamilyDescription[] = [...stubFamilies.entries()].map(([tempId, entry]) => ({
            type: "FamilyDescription",
            id: tempId,
            parents: entry.anchorRole === "parent" ? [entry.anchorPersonId] : [],
            children: entry.anchorRole === "child" ? [entry.anchorPersonId] : [],
            readOnly: true,
        }));
        return {
            ...stemma,
            families: [...stemma.families, ...stubFamilyDescriptions],
        };
    });

    const augmentedStemmaIndex = $derived.by<StemmaIndex | null>(() => {
        if (!augmentedStemma) return null;
        return new StemmaIndex(augmentedStemma);
    });

    $effect(() => {
        if (!stemmaChart) return;
        void stubFamilies;
        void pendingRemovedPersonIds;
        void pendingRemovedFamilyIds;
        tick().then(() => applyPendingClasses());
    });

    function applyPendingClasses() {
        const svgEl = document.getElementById("chart");
        if (!svgEl) return;
        svgEl.querySelectorAll("circle.v2-pending-remove, circle.stub-family").forEach((el) => {
            el.classList.remove("v2-pending-remove", "stub-family");
        });
        const markCircle = (nodeId: string, cls: string) => {
            const el = document.getElementById(nodeId);
            const circle = el?.querySelector("circle");
            if (circle) circle.classList.add(cls);
        };
        stubFamilies.forEach((_entry, tempId) => markCircle(normalizeId("family", tempId), "stub-family"));
        pendingRemovedPersonIds.forEach((id) => markCircle(normalizeId("person", id), "v2-pending-remove"));
        pendingRemovedFamilyIds.forEach((id) => markCircle(normalizeId("family", id), "v2-pending-remove"));
    }

    type GhostSpec = {
        x: number;
        y: number;
        w: number;
        h: number;
        label: string;
        ariaLabel: string;
        extraClass: string;
        testid: string;
        popoverState: (btn: HTMLButtonElement) => GhostPopoverState;
    };

    const PERSON_GHOST_GEOM = { x: 18, y: -32, w: 28, h: 28 } as const;
    const FAMILY_GHOST_GEOM: Record<GhostFamilyAction, { y: number; slug: "child" | "parent" }> = {
        addChild: { y: 14, slug: "child" },
        addParent: { y: -38, slug: "parent" },
    };

    type GhostLabels = {
        addChildLabel: string;
        addSpouseLabel: string;
        addChildAria: string;
        addSpouseAria: string;
        person: string;
    };

    let mountSeq = 0;

    $effect(() => {
        const enabled = editMode;
        const idx = augmentedStemmaIndex;
        void stemmaChart;
        const labels: GhostLabels = {
            addChildLabel: $t("v2.addChild"),
            addSpouseLabel: $t("v2.addSpouse"),
            addChildAria: $t("v2.familyGhostAddChild"),
            addSpouseAria: $t("v2.familyGhostAddSpouse"),
            person: $t("v2.personGhostLabel"),
        };
        if (!stemmaChart) return;
        const seq = ++mountSeq;
        tick().then(() => {
            if (seq !== mountSeq) return;
            mountGhosts(enabled, idx, labels);
        });
    });

    function mountGhosts(
        enabled: boolean,
        idx: StemmaIndex | null,
        labels: GhostLabels,
    ) {
        const svgEl = document.getElementById("chart");
        if (!svgEl) return;
        const nodes = svgEl.querySelectorAll<SVGGElement>("g[id^='person_'], g[id^='family_'], .v2-ghost-mount");
        nodes.forEach((el) => {
            if (el.classList.contains("v2-ghost-mount")) el.remove();
        });
        if (!enabled) return;
        nodes.forEach((g) => {
            if (g.classList.contains("v2-ghost-mount")) return;
            const id = g.id;
            if (id.startsWith("person_")) {
                const personId = denormalizeId(id);
                if ((idx?.relatedFamilies(personId).length ?? 0) > 0) return;
                mountGhost(g, {
                    ...PERSON_GHOST_GEOM,
                    label: "+",
                    ariaLabel: labels.person,
                    extraClass: "v2-ghost-person",
                    testid: `v2-person-ghost-${personId}`,
                    popoverState: (btn) => ({ kind: "personRole", anchorEl: btn, personId }),
                });
            } else if (id.startsWith("family_")) {
                const familyId = denormalizeId(id);
                const family = idx?.family(familyId) ?? null;
                mountGhost(g, makeFamilyGhostSpec(familyId, "addChild", labels.addChildLabel, labels.addChildAria));
                if (canAddParentToFamily(family)) {
                    mountGhost(g, makeFamilyGhostSpec(familyId, "addParent", labels.addSpouseLabel, labels.addSpouseAria));
                }
            }
        });
    }

    function makeFamilyGhostSpec(familyId: string, action: GhostFamilyAction, label: string, ariaLabel: string): GhostSpec {
        const geom = FAMILY_GHOST_GEOM[action];
        return {
            x: -32, y: geom.y, w: 64, h: 24,
            label,
            ariaLabel,
            extraClass: "v2-ghost-family",
            testid: `v2-family-ghost-${geom.slug}-${familyId}`,
            popoverState: (btn) => ({ kind: "familyAdd", anchorEl: btn, familyId, action }),
        };
    }

    function mountGhost(g: SVGGElement, spec: GhostSpec) {
        const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject") as SVGForeignObjectElement;
        fo.setAttribute("class", "v2-ghost-mount");
        fo.setAttribute("x", String(spec.x));
        fo.setAttribute("y", String(spec.y));
        fo.setAttribute("width", String(spec.w));
        fo.setAttribute("height", String(spec.h));
        fo.style.overflow = "visible";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `v2-ghost-btn ${spec.extraClass}`.trim();
        btn.textContent = spec.label;
        btn.setAttribute("aria-label", spec.ariaLabel);
        btn.setAttribute("data-testid", spec.testid);
        btn.addEventListener("pointerdown", (e) => e.stopPropagation());
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            ghostPopover = spec.popoverState(btn);
        });

        fo.appendChild(btn);
        g.appendChild(fo);
    }

    function closeGhostPopover() {
        ghostPopover = null;
    }

    function handleGhostPersonPick(role: "parent" | "child") {
        if (!ghostPopover || ghostPopover.kind !== "personRole") return;
        const personId = ghostPopover.personId;
        ghostPopover = null;
        handleFamilyStubRequested(personId, role);
    }

    function handleGhostFamilyConfirm(arg: PersonArg) {
        if (!ghostPopover || ghostPopover.kind !== "familyAdd") return;
        const { familyId, action } = ghostPopover;
        const stub = stubFamilies.get(familyId);
        ghostPopover = null;
        if (stub) {
            handleCreateFamilyFromStub(buildStubPayload(
                { stubId: familyId, anchorPersonId: stub.anchorPersonId, anchorRole: stub.anchorRole },
                action,
                arg,
            ));
        } else {
            appendToFamily(familyId, action, arg);
        }
    }

    function errorMessage(err: Error): string {
        if (err instanceof LocalizedError) return $t(err.key, err.params);
        return err.message;
    }

    function handlePersonSelected(person: PersonDescription) {
        if (pendingRemovedPersonIds.has(person.id)) return;
        personEditModal?.showPersonDetails({
            description: person,
            pin: pinnedPeople?.isPinned(person.id) ?? false,
        });
    }

    function handleFamilySelected(family: FamilyDescription) {
        const tempId = family.id;
        if (stubFamilies.has(tempId)) return;
        if (pendingRemovedFamilyIds.has(tempId)) return;
        selectedFamilyEl = document.getElementById(normalizeId("family", tempId));
        selectedFamilyId = tempId;
        familySheetOpen = true;
    }

    function closeFamilySheet() {
        familySheetOpen = false;
        selectedFamilyId = null;
        selectedFamilyEl = null;
    }

    function handleFamilyStubRequested(anchorPersonId: string, anchorRole: "parent" | "child") {
        const tempId = "stub-" + crypto.randomUUID();
        stubFamilies = new Map([...stubFamilies, [tempId, { anchorPersonId, anchorRole }]]);
    }

    type FamilyMembers = { parents: PersonArg[]; children: PersonArg[] };

    const STUB_FAMILY_LAYOUT: Record<`${"parent" | "child"}-${GhostFamilyAction}`, (a: PersonArg, o: PersonArg) => FamilyMembers> = {
        "parent-addChild": (a, o) => ({ parents: [a], children: [o] }),
        "parent-addParent": (a, o) => ({ parents: [a, o], children: [] }),
        "child-addChild": (a, o) => ({ parents: [], children: [a, o] }),
        "child-addParent": (a, o) => ({ parents: [o], children: [a] }),
    };

    function payloadOther(payload: FamilyFromStubPayload): PersonArg {
        return payload.existingPersonId
            ? { type: "ExistingPerson", id: payload.existingPersonId }
            : payload.newPerson!;
    }

    function handleCreateFamilyFromStub(payload: FamilyFromStubPayload) {
        const anchor: PersonArg = { type: "ExistingPerson", id: payload.anchorPersonId };
        const { parents, children } = STUB_FAMILY_LAYOUT[`${payload.anchorRole}-${payload.action}`](anchor, payloadOther(payload));

        const next = new Map(stubFamilies);
        next.delete(payload.stubId);
        stubFamilies = next;

        controller.createFamily(parents, children, { silent: true }).catch(() => {});
    }

    function appendToFamily(familyId: string, action: GhostFamilyAction, person: PersonArg) {
        if (!stemmaIndex) return;
        const family = stemmaIndex.family(familyId);
        const asArgs = (ids: string[]): PersonArg[] => ids.map((id) => ({ type: "ExistingPerson", id }));
        const parents = action === "addParent" ? [...asArgs(family.parents), person] : asArgs(family.parents);
        const children = action === "addChild" ? [...asArgs(family.children), person] : asArgs(family.children);
        controller.updateFamily(familyId, parents, children, { silent: true }).catch(() => {});
    }

    function runCreateOrphanPerson(name: string) {
        controller.createOrphanPerson({ type: "CreateNewPerson", name }, { silent: true }).catch(() => {});
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
        promptModal?.prompt({
            title: $t("v2.addPerson"),
            label: $t("v2.namePlaceholder"),
            confirmLabel: $t("common.add"),
            testid: "v2-name-modal",
            inputTestid: "v2-name-input",
            confirmTestid: "v2-name-confirm",
            onaccept: (name) => runCreateOrphanPerson(name),
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
            confirmLabel: $t("common.delete"),
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

    const showCanvas = $derived(!isWorking && augmentedStemma && augmentedStemmaIndex && highlight && pinnedPeople);
    const showEmpty = $derived(!isWorking && stemma && stemma.people.length === 0);
</script>

{#if signedIn}
    <div class="v2-layout">
        <div class="v2-canvas-layer">
            {#if showCanvas}
                <FullStemma
                    bind:this={stemmaChart}
                    hidden={isWorking}
                    stemma={augmentedStemma!}
                    currentStemmaId={currentStemmaId ?? ""}
                    stemmaIndex={augmentedStemmaIndex!}
                    highlight={highlight!}
                    pinnedPeople={pinnedPeople!}
                    viewMode={ViewMode.ALL}
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
                {#if editMode}
                    <V2EditPill />
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
                    disabled={isWorking}
                    oneditToggle={() => { editMode = !editMode; }}
                    onaddPerson={openAddPerson}
                />
            </div>

            {#if !isWorking && stemma && stemmaIndex && highlight}
                <div class="v2-bottom-left">
                    <StatsCard {stemma} {stemmaIndex} {highlight} {highlightVersion} />
                </div>
            {/if}
        </div>

        {#if isWorking}
            <div class="v2-loading">
                <Circle2 />
                <p class="mt-2">{$t("app.loading")}</p>
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

    <V2Sheet
        open={ghostPopover !== null}
        anchorEl={ghostPopover?.anchorEl ?? null}
        onclose={closeGhostPopover}
        testid="v2-ghost-popover"
    >
        {#snippet body()}
            {#if ghostPopover?.kind === "personRole"}
                <V2PersonGhost
                    onpick={handleGhostPersonPick}
                    oncancel={closeGhostPopover}
                />
            {:else if ghostPopover?.kind === "familyAdd" && stemma && stemmaIndex}
                <V2FamilyGhost
                    action={ghostPopover.action}
                    stemma={stemma}
                    stemmaIndex={stemmaIndex}
                    onconfirm={handleGhostFamilyConfirm}
                    oncancel={closeGhostPopover}
                />
            {/if}
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

    :global(.stub-family) {
        stroke-dasharray: 6 3;
        stroke: #6c757d;
    }

    :global(.v2-pending-remove) {
        stroke-dasharray: 4 4;
        stroke: #dc3545;
        opacity: 0.45;
        animation: v2-pending-pulse 1.2s ease-in-out infinite;
    }

    @keyframes v2-pending-pulse {
        0%, 100% { stroke-opacity: 1; }
        50% { stroke-opacity: 0.35; }
    }

    :global(.v2-ghost-mount) {
        pointer-events: auto;
        overflow: visible;
    }

    :global(.v2-ghost-btn) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(13, 110, 253, 0.55);
        background: rgba(255, 255, 255, 0.7);
        color: #0d6efd;
        font-weight: 600;
        font-size: 0.78rem;
        line-height: 1;
        padding: 0;
        cursor: pointer;
        backdrop-filter: blur(2px);
        transition: opacity 0.1s ease, background-color 0.1s ease, transform 0.1s ease;
        opacity: 0.55;
        user-select: none;
        white-space: nowrap;
    }

    :global(.v2-ghost-btn:hover) {
        opacity: 1;
        background: #fff;
        transform: scale(1.05);
    }

    :global(.v2-ghost-btn.v2-ghost-person) {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        font-size: 1.1rem;
    }

    :global(.v2-ghost-btn.v2-ghost-family) {
        height: 20px;
        padding: 0 8px;
        border-radius: 10px;
    }
</style>
