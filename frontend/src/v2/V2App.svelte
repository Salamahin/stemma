<script lang="ts">
    import { onMount, untrack } from "svelte";
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
    import V2Menu from "./components/V2Menu.svelte";
    import V2Fab from "./components/V2Fab.svelte";
    import V2EditPill from "./components/V2EditPill.svelte";
    import V2Search from "./components/V2Search.svelte";
    import V2EmptyState from "./components/V2EmptyState.svelte";
    import V2Sheet from "./components/V2Sheet.svelte";
    import V2PersonCard from "./components/V2PersonCard.svelte";
    import V2FamilyCard from "./components/V2FamilyCard.svelte";
    import V2AboutModal from "./components/V2AboutModal.svelte";
    import V2SettingsModal from "./components/V2SettingsModal.svelte";
    import V2ShareModal from "./components/V2ShareModal.svelte";
    import V2InviteLinkModal from "./components/V2InviteLinkModal.svelte";
    import V2PromptModal from "./components/V2PromptModal.svelte";
    import V2ConfirmModal from "./components/V2ConfirmModal.svelte";
    import V2PersonDetailsModal from "./components/V2PersonDetailsModal.svelte";
    import StatsCard from "../components/stats_card/StatsCard.svelte";
    import { buildInviteLink } from "../inviteLinkBuilder";
    import { personDisplayName } from "../personDisplayName";
    import { Circle2 } from "svelte-loading-spinners";

    type StubEntry = { anchorPersonId: string; anchorRole: "parent" | "child" };

    type StubContext = {
        stubId: string;
        anchorPersonId: string;
        anchorRole: "parent" | "child";
    };

    type FamilyFromStubPayload = {
        stubId: string;
        anchorPersonId: string;
        anchorRole: "parent" | "child";
        action: "addChild" | "addSpouse";
        newPerson?: CreateNewPerson;
        existingPersonId?: string;
    };

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

    let ownedStemmas = $state<StemmaDescription[]>([]);
    let currentStemmaId = $state<string | null>(null);
    let stemma = $state<Stemma | null>(null);
    let stemmaIndex = $state<StemmaIndex | null>(null);
    let highlight = $state<HiglightLineages | null>(null);
    let pinnedPeople = $state<PinnedPeopleStorage | null>(null);
    let isWorking = $state<boolean>(false);
    let error = $state<Error | null>(null);
    let highlightVersion = $state(0);

    let selectedPerson = $state<PersonDescription | null>(null);
    let selectedPersonEl = $state<Element | null>(null);
    let personSheetOpen = $state(false);

    let selectedFamilyId = $state<string | null>(null);
    let selectedFamilyStub = $state<StubContext | null>(null);
    let selectedFamilyEl = $state<Element | null>(null);
    let familySheetOpen = $state(false);

    let personEditModal = $state<ReturnType<typeof V2PersonDetailsModal> | null>(null);
    let aboutModal = $state<ReturnType<typeof V2AboutModal> | null>(null);
    let settingsModal = $state<ReturnType<typeof V2SettingsModal> | null>(null);
    let shareModal = $state<ReturnType<typeof V2ShareModal> | null>(null);
    let inviteLinkModal = $state<ReturnType<typeof V2InviteLinkModal> | null>(null);
    let promptModal = $state<ReturnType<typeof V2PromptModal> | null>(null);
    let confirmModal = $state<ReturnType<typeof V2ConfirmModal> | null>(null);
    let stemmaChart = $state<ReturnType<typeof FullStemma> | null>(null);

    const controller = new AppController(untrack(() => stemma_backend_url));

    const subscriptions = [
        controller.currentStemmaId.subscribe((s) => (currentStemmaId = s)),
        controller.stemma.subscribe((s) => {
            stemma = s;
            stubFamilies = new Map();
        }),
        controller.ownedStemmas.subscribe((os) => (ownedStemmas = os)),
        controller.stemmaIndex.subscribe((si) => (stemmaIndex = si)),
        controller.highlight.subscribe((hg) => (highlight = hg)),
        controller.pinnedStorage.subscribe((pp) => (pinnedPeople = pp)),
        controller.isWorking.subscribe((iw) => (isWorking = iw)),
        controller.err.subscribe((e) => (error = e)),
        controller.invitationToken.subscribe((tkn) => {
            if (!tkn) return;
            shareModal?.close();
            const link = buildInviteLink(window.location.origin, tkn);
            inviteLinkModal?.show(link);
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
        if (!stemmaChart || !stubFamilies) return;
        stubFamilies.forEach((_entry, tempId) => {
            const familyEl = document.getElementById(`family_${tempId}`);
            if (familyEl) {
                const circle = familyEl.querySelector("circle");
                if (circle) {
                    circle.classList.add("stub-family");
                    circle.setAttribute("r", "14");
                }
                if (!familyEl.querySelector(".stub-plus")) {
                    const plusText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    plusText.setAttribute("class", "stub-plus");
                    plusText.setAttribute("text-anchor", "middle");
                    plusText.setAttribute("dominant-baseline", "central");
                    plusText.setAttribute("font-size", "14");
                    plusText.setAttribute("font-weight", "bold");
                    plusText.setAttribute("fill", "#6c757d");
                    plusText.setAttribute("pointer-events", "none");
                    plusText.textContent = "+";
                    familyEl.appendChild(plusText);
                }
            }
        });
    });

    function errorMessage(err: Error): string {
        if (err instanceof LocalizedError) return $t(err.key, err.params);
        return err.message;
    }

    function handlePersonSelected(person: PersonDescription) {
        selectedPerson = person;
        selectedPersonEl = document.getElementById(`person_${person.id}`);
        personSheetOpen = true;
    }

    function handleFamilySelected(family: FamilyDescription) {
        const tempId = family.id;
        const stub = stubFamilies.get(tempId);
        selectedFamilyEl = document.getElementById(`family_${tempId}`);
        if (stub) {
            selectedFamilyStub = { stubId: tempId, anchorPersonId: stub.anchorPersonId, anchorRole: stub.anchorRole };
            selectedFamilyId = null;
        } else {
            selectedFamilyStub = null;
            selectedFamilyId = tempId;
        }
        familySheetOpen = true;
    }

    function closePersonSheet() {
        personSheetOpen = false;
        selectedPerson = null;
        selectedPersonEl = null;
    }

    function closeFamilySheet() {
        familySheetOpen = false;
        selectedFamilyId = null;
        selectedFamilyStub = null;
        selectedFamilyEl = null;
    }

    function handleFamilyStubRequested(anchorPersonId: string, anchorRole: "parent" | "child") {
        const tempId = "stub-" + crypto.randomUUID();
        stubFamilies = new Map([...stubFamilies, [tempId, { anchorPersonId, anchorRole }]]);
        selectedFamilyStub = { stubId: tempId, anchorPersonId, anchorRole };
        selectedFamilyId = null;
        selectedFamilyEl = null;
        familySheetOpen = true;
    }

    function handlePersonEditRequested(personId: string) {
        if (!stemmaIndex) return;
        const p = stemmaIndex.person(personId);
        personEditModal?.showPersonDetails({ description: p, pin: pinnedPeople?.isPinned(personId) ?? false });
    }

    function personArg(payload: FamilyFromStubPayload) {
        if (payload.existingPersonId) return { type: "ExistingPerson" as const, id: payload.existingPersonId };
        return payload.newPerson!;
    }

    function handleCreateFamilyFromStub(payload: FamilyFromStubPayload) {
        const anchor = { type: "ExistingPerson" as const, id: payload.anchorPersonId };
        const other = personArg(payload);

        if (payload.anchorRole === "parent" && payload.action === "addChild") {
            controller.createFamily([anchor], [other]);
        } else if (payload.anchorRole === "parent" && payload.action === "addSpouse") {
            controller.createFamily([anchor, other], []);
        } else if (payload.anchorRole === "child" && payload.action === "addSpouse") {
            controller.createFamily([other], [anchor]);
        } else {
            controller.createFamily([], [anchor, other]);
        }

        const next = new Map(stubFamilies);
        next.delete(payload.stubId);
        stubFamilies = next;
    }

    function handleCreateChildInFamily(payload: { familyId: string; person: CreateNewPerson | { type: "ExistingPerson"; id: string } }) {
        if (!stemmaIndex) return;
        const family = stemmaIndex.family(payload.familyId);
        const parents = family.parents.map((id) => ({ type: "ExistingPerson" as const, id }));
        const children = [
            ...family.children.map((id) => ({ type: "ExistingPerson" as const, id })),
            payload.person,
        ];
        controller.updateFamily(payload.familyId, parents, children);
    }

    function handleCreateSpouseInFamily(payload: { familyId: string; person: CreateNewPerson | { type: "ExistingPerson"; id: string } }) {
        if (!stemmaIndex) return;
        const family = stemmaIndex.family(payload.familyId);
        const parents = [
            ...family.parents.map((id) => ({ type: "ExistingPerson" as const, id })),
            payload.person,
        ];
        const children = family.children.map((id) => ({ type: "ExistingPerson" as const, id }));
        controller.updateFamily(payload.familyId, parents, children);
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
            onaccept: (name) => controller.createOrphanPerson({ type: "CreateNewPerson", name }),
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
            onaccept: () => controller.removeFamily(familyId),
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
                controller.removePerson(payload.id);
                personEditModal?.dismiss();
            },
        });
    }

    function handleShareRequested(personId: string) {
        if (!stemmaIndex) return;
        const p = stemmaIndex.person(personId);
        shareModal?.show({
            personId,
            personName: personDisplayName(p.name, $t),
        });
    }

    onMount(() => {
        if (e2eAutoLoginEnabled) {
            e2eMode = true;
            handleSignIn({ id_token: "e2e-user@stemma.local" } as User);
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
        open={personSheetOpen}
        anchorEl={selectedPersonEl}
        onclose={closePersonSheet}
        testid="v2-person-sheet"
    >
        {#snippet body()}
            {#if selectedPerson}
                <V2PersonCard
                    person={selectedPerson}
                    {editMode}
                    onfamilyStubRequested={handleFamilyStubRequested}
                    onpersonEditRequested={handlePersonEditRequested}
                    onshareRequested={handleShareRequested}
                    onclose={closePersonSheet}
                />
            {/if}
        {/snippet}
    </V2Sheet>

    <V2Sheet
        open={familySheetOpen}
        anchorEl={selectedFamilyEl}
        onclose={closeFamilySheet}
        testid="v2-family-sheet"
    >
        {#snippet body()}
            <V2FamilyCard
                stemma={stemma ?? { type: "Stemma", people: [], families: [] }}
                stemmaIndex={stemmaIndex}
                {editMode}
                familyId={selectedFamilyId}
                stubCtx={selectedFamilyStub}
                oncreateFamilyFromStub={handleCreateFamilyFromStub}
                oncreateChildInFamily={handleCreateChildInFamily}
                oncreateSpouseInFamily={handleCreateSpouseInFamily}
                onfamilyRemoveRequested={handleFamilyRemoveRequested}
                onclose={closeFamilySheet}
            />
        {/snippet}
    </V2Sheet>

    <V2PersonDetailsModal
        bind:this={personEditModal}
        onpersonUpdated={(p) => controller.savePerson(p.id, p.description, p.pin, p.photoUpload, p.photoRemove)}
        onpersonRemoveRequested={handlePersonRemoveRequested}
    />

    <V2AboutModal bind:this={aboutModal} />
    <V2SettingsModal bind:this={settingsModal} />
    <V2ShareModal
        bind:this={shareModal}
        oninvite={(p) => controller.createInvitationToken(p.personId, p.email)}
    />
    <V2InviteLinkModal bind:this={inviteLinkModal} />
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
        z-index: 100;
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

    .v2-top-right {
        position: absolute;
        top: 16px;
        right: 16px;
        pointer-events: auto;
        z-index: 100;
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
</style>
