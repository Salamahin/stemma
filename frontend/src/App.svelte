<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { AppController } from "./appController";
    import type {
        FamilyDescription,
        PersonDescription,
        Stemma,
        StemmaDescription,
    } from "./model";
    import { StemmaIndex } from "./stemmaIndex";
    import { HighlightLineages } from "./highlight";
    import { PinnedPeopleStorage } from "./pinnedPeopleStorage";
    import { ViewMode } from "./model";
    import { LocalizedError, t } from "./i18n";
    import { disableAutoSelect, initializeGoogleAuth } from "./googleAuth";
    import Authenticate from "./components/Authenticate.svelte";
    import FullStemma from "./components/FullStemma.svelte";
    import Sheet from "./components/Sheet.svelte";
    import FamilyCard from "./components/FamilyCard.svelte";
    import EmptyState from "./components/EmptyState.svelte";
    import AboutModal from "./components/AboutModal.svelte";
    import SettingsModal from "./components/SettingsModal.svelte";
    import ShareAccessModal from "./components/ShareAccessModal.svelte";
    import PromptModal from "./components/PromptModal.svelte";
    import ConfirmModal from "./components/ConfirmModal.svelte";
    import PersonDetailsModal from "./components/PersonDetailsModal.svelte";
    import FocusController from "./components/FocusController.svelte";
    import GhostLayer from "./components/GhostLayer.svelte";
    import DragGestures from "./components/DragGestures.svelte";
    import EditModeOverlay from "./components/EditModeOverlay.svelte";
    import Chrome from "./components/Chrome.svelte";
    import PendingVisuals from "./components/PendingVisuals.svelte";
    import Minimap from "./components/Minimap.svelte";
    import { buildInviteLink } from "./inviteLinkBuilder";
    import { Circle2 } from "svelte-loading-spinners";
    import { normalizeId } from "./graphTools";
    import type { FocusedId } from "./focusGesture";
    import { isPendingId, pendingPersonDescription } from "./pendingState";
    import { MutationActions } from "./mutationActions";
    import { ModalActions } from "./modalActions";
    import { Session } from "./session";
    import type { PendingAdd, PendingFamily } from "./pendingState";

    type Props = { google_client_id: string; stemma_backend_url: string };
    let { google_client_id, stemma_backend_url }: Props = $props();

    let editMode = $state(false);
    let panMode = $state(false);
    let spacePan = $state(false);
    const panActive = $derived(editMode && (panMode || spacePan));

    let ownedStemmas = $state<StemmaDescription[]>([]);
    let currentStemmaId = $state<string | null>(null);
    let stemma = $state<Stemma | null>(null);
    let stemmaIndex = $state<StemmaIndex | null>(null);
    let highlight = $state<HighlightLineages | null>(null);
    let pinnedPeople = $state<PinnedPeopleStorage | null>(null);
    let isWorking = $state<boolean>(false);
    let error = $state<Error | null>(null);
    let highlightVersion = $state(0);

    let selectedFamilyId = $state<string | null>(null);
    let selectedFamilyEl = $state<Element | null>(null);
    let familySheetOpen = $state(false);
    let focusedId = $state<FocusedId | null>(null);
    let ghostSimPositions = $state<Array<{ x: number; y: number }>>([]);

    let personEditModal = $state<ReturnType<typeof PersonDetailsModal> | null>(null);
    let aboutModal = $state<ReturnType<typeof AboutModal> | null>(null);
    let settingsModal = $state<ReturnType<typeof SettingsModal> | null>(null);
    let shareAccessModal = $state<ReturnType<typeof ShareAccessModal> | null>(null);
    let promptModal = $state<ReturnType<typeof PromptModal> | null>(null);
    let confirmModal = $state<ReturnType<typeof ConfirmModal> | null>(null);
    let stemmaChart = $state<ReturnType<typeof FullStemma> | null>(null);
    let minimap = $state<ReturnType<typeof Minimap> | null>(null);

    const controller = new AppController(untrack(() => stemma_backend_url));

    let pendingAdds = $state<PendingAdd[]>([]);
    let pendingFamilies = $state<PendingFamily[]>([]);
    let pendingRemovedPersonIds = $state<Set<string>>(new Set());
    let pendingRemovedFamilyIds = $state<Set<string>>(new Set());
    let signedIn = $state(false);
    let bootProbing = $state(true);

    const actions = new MutationActions({
        controller,
        getStemmaIndex: () => stemmaIndex,
        getStemmaChart: () => stemmaChart,
        getPersonEditModal: () => personEditModal,
        addsRef: { get: () => pendingAdds, set: (v) => (pendingAdds = v) },
        familiesRef: { get: () => pendingFamilies, set: (v) => (pendingFamilies = v) },
        removedPersonIdsRef: { get: () => pendingRemovedPersonIds, set: (v) => (pendingRemovedPersonIds = v) },
        removedFamilyIdsRef: { get: () => pendingRemovedFamilyIds, set: (v) => (pendingRemovedFamilyIds = v) },
    });

    const modals = new ModalActions({
        controller,
        actions,
        getPromptModal: () => promptModal,
        getConfirmModal: () => confirmModal,
        getPersonModal: () => personEditModal,
    });

    const session = new Session(
        controller.model,
        { get: () => signedIn, set: (v) => (signedIn = v) },
        {
            onSignIn: () => {
                void loadStemmasOrSignOut();
            },
            onSignOut: () => disableAutoSelect(),
        },
    );

    async function loadStemmasOrSignOut(): Promise<void> {
        try {
            await controller.listStemmas();
        } catch (err) {
            if ((err as { key?: string }).key === "error.sessionExpired") {
                session.markSignedOut();
                return;
            }
            error = err as Error;
            console.error("Listing stemmas failed", err);
        }
    }

    async function handleGoogleSignIn(idToken: string) {
        try {
            await session.signIn(idToken);
        } catch (err) {
            error = err as Error;
            console.error("Sign-in failed", err);
        }
    }

    let lastStemmaIdSeen: string | null = null;
    const subscriptions = [
        controller.currentStemmaId.subscribe((s) => (currentStemmaId = s)),
        controller.stemma.subscribe((s) => {
            const switchedStemma = currentStemmaId !== lastStemmaIdSeen;
            lastStemmaIdSeen = currentStemmaId;
            stemma = s;
            if (s === null || switchedStemma) actions.reset();
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

    const displayedStemmaIndex = $derived.by<StemmaIndex | null>(() =>
        displayedStemma ? new StemmaIndex(displayedStemma) : null,
    );

    $effect(() => {
        if (editMode) return;
        panMode = false;
        spacePan = false;
        focusedId = null;
        untrack(() => actions.cleanupIncompletePendingFamiliesOnExitEdit());
    });

    // Pan activation clears focus so ghosts dismiss before canvas drag.
    $effect(() => {
        if (panActive) focusedId = null;
    });

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

    function handleNodeActivation(f: FocusedId) {
        if (f.kind === "person") {
            const person = displayedStemmaIndex?.person(f.id);
            if (person) handlePersonSelected(person);
        } else {
            const family = displayedStemmaIndex?.family(f.id);
            if (family) handleFamilySelected(family);
        }
    }

    function closeFamilySheet() {
        familySheetOpen = false;
        selectedFamilyId = null;
        selectedFamilyEl = null;
    }

    async function probeCookieSession() {
        try {
            await controller.listStemmas();
            signedIn = true;
        } catch (err) {
            if ((err as { key?: string }).key === "error.sessionExpired") {
                signedIn = false;
                fetch(`${stemma_backend_url}/warmup`).catch(() => {});
                return;
            }
            error = err as Error;
        }
    }

    onMount(() => {
        const boot = session.e2eAutoLoginEnabled
            ? session.signInAsE2eUser()
            : (initializeGoogleAuth(google_client_id).catch((err) =>
                  console.error("Google Identity init failed", err),
              ),
              probeCookieSession());
        void Promise.resolve(boot).finally(() => (bootProbing = false));
        return () => {
            for (const unsub of subscriptions) unsub();
        };
    });

    const showCanvas = $derived(!isWorking && displayedStemma && displayedStemmaIndex && highlight && pinnedPeople);
    const showEmpty = $derived(!isWorking && stemma && stemma.people.length === 0);
</script>

{#if bootProbing}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Circle2 />
        </div>
    </div>
{:else if signedIn}
    <div class="layout" class:edit-mode={editMode}>
        <EditModeOverlay {editMode} />

        <div class="canvas-layer">
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
                    hoverHighlight={!editMode}
                    onpersonSelected={handlePersonSelected}
                    onfamilySelected={handleFamilySelected}
                    onhighlightChanged={() => highlightVersion++}
                    onzoomChanged={() => minimap?.refresh()}
                />
            {/if}

            {#if showEmpty}
                <EmptyState {editMode} onaddPerson={() => modals.addPerson()} />
            {/if}
        </div>

        <FocusController
            {editMode}
            stemmaChartReady={!!stemmaChart}
            {ghostSimPositions}
            {focusedId}
            onfocusChange={(f) => (focusedId = f)}
        />
        <GhostLayer
            {focusedId}
            stemmaIndex={displayedStemmaIndex}
            stemmaChartReady={!!stemmaChart}
            getSimulation={() => stemmaChart?.getSimulation() ?? null}
            applyManualPositions={() => stemmaChart?.applyManualPositions()}
            onghostClick={(kind, focused, pins, existingFamilyId) => actions.onGhostClick(kind, focused, pins, existingFamilyId)}
            onpositionsChange={(p) => (ghostSimPositions = p)}
        />
        <DragGestures
            {editMode}
            {panActive}
            {panMode}
            stemmaChartReady={!!stemmaChart}
            {displayedStemmaIndex}
            findPendingFamily={(id) => actions.findFamily(id)}
            popHover={() => stemmaChart?.popHover()}
            onattachPersonToFamily={(personId, familyId, role, pinAt) => actions.attachPersonToFamily(personId, familyId, role, pinAt)}
            oncreatePersonInFamily={(familyId, role, title, pinAt) => actions.createPersonInFamily(familyId, role, title, pinAt)}
            oncreatePendingFamily={(personId, role, familyAt) => { actions.createPendingFamilyForPerson(personId, role, familyAt); }}
            onshortTapFocus={(f) => (focusedId = f)}
            onlongPress={handleNodeActivation}
            ondesktopNodeClick={handleNodeActivation}
            onclearFocus={() => (focusedId = null)}
            onclosePanMode={() => (panMode = false)}
            onspacePanChange={(v) => (spacePan = v)}
        />
        <PendingVisuals
            adds={pendingAdds}
            families={pendingFamilies}
            removedPersonIds={pendingRemovedPersonIds}
            removedFamilyIds={pendingRemovedFamilyIds}
            stemmaChartReady={!!stemmaChart}
        />

        <Minimap
            bind:this={minimap}
            {editMode}
            stemmaChartReady={!!stemmaChart}
            getSimulation={() => stemmaChart?.getSimulation() ?? null}
            getZoomTransform={() => stemmaChart?.getZoomTransform() ?? null}
            applyZoomTranslate={(tx, ty) => stemmaChart?.applyZoomTranslate(tx, ty)}
        />

        <Chrome
            {ownedStemmas}
            {currentStemmaId}
            {isWorking}
            {stemma}
            {stemmaIndex}
            {highlight}
            {highlightVersion}
            {editMode}
            {panMode}
            showSignOut={!session.e2eAutoLoginEnabled}
            onstemmaSelect={(id) => controller.selectStemma(id)}
            onstemmaAddNew={() => modals.addStemma()}
            onstemmaRename={(s) => modals.renameStemma(s)}
            onstemmaClone={(s) => modals.cloneStemma(s)}
            onstemmaRemove={(s) => modals.removeStemma(s)}
            onsearchSelect={(id) => stemmaChart?.zoomToNode(id)}
            onabout={() => aboutModal?.show()}
            onsettings={() => settingsModal?.show()}
            onexport={() => stemmaChart?.exportSvg($t("nav.exportDefaultName"))}
            onsignOut={() => session.signOut()}
            oneditToggle={() => { editMode = !editMode; }}
            onpanToggle={() => { panMode = !panMode; }}
            onaddPerson={() => modals.addPerson()}
        />

        {#if isWorking}
            <div class="loading">
                <Circle2 />
                <p class="mt-2">{$t("app.loading")}</p>
            </div>
        {/if}

        {#if error}
            <div class="error-bar">
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

    <Sheet
        open={familySheetOpen}
        anchorEl={selectedFamilyEl}
        onclose={closeFamilySheet}
        testid="family-sheet"
    >
        {#snippet body()}
            <FamilyCard
                stemmaIndex={stemmaIndex}
                {editMode}
                familyId={selectedFamilyId}
                onfamilyRemoveRequested={(id) => modals.confirmRemoveFamily(id)}
                onclose={closeFamilySheet}
            />
        {/snippet}
    </Sheet>

    <PersonDetailsModal
        bind:this={personEditModal}
        {editMode}
        onpersonUpdated={(p) => controller.savePerson(p.id, p.description, p.pin, p.photoUpload, p.photoRemove)}
        onpersonRemoveRequested={(p) => modals.confirmRemovePerson(p)}
        onshareAccessRequested={(p) => shareAccessModal?.show(p)}
    />

    <AboutModal bind:this={aboutModal} />
    <SettingsModal bind:this={settingsModal} />
    <ShareAccessModal
        bind:this={shareAccessModal}
        oncreate={(p) => controller.createInvitationToken(p.personId, p.email)}
    />
    <PromptModal bind:this={promptModal} />
    <ConfirmModal bind:this={confirmModal} />
{:else}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Authenticate {google_client_id} onsignIn={handleGoogleSignIn} />
        </div>
    </div>
{/if}

<style>
    :global(:root) {
        ---text-primary: #212529;
        ---text-secondary: #495057;
        ---text-muted: #6c757d;
        ---bg-surface: #fff;
        ---border-subtle: #f0f0f0;
        ---radius-modal: 16px;
        ---fs-title: 1rem;
        ---fs-body: 0.9rem;
        ---fs-label: 0.85rem;
        ---fs-hint: 0.8rem;
        ---fw-title: 700;
        ---fw-section: 600;
        ---fw-label: 500;
    }

    .layout {
        position: relative;
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        background: #f8f9fa;
    }

    .canvas-layer {
        position: absolute;
        inset: 0;
    }

    :global(.canvas-layer #chart) {
        min-height: 100vh;
        min-height: 100dvh;
        padding: 0 !important;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
    }

    :global(.edit-mode .canvas-layer #chart) {
        touch-action: none;
    }

    :global(.canvas-layer #chart text) {
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
    }

    .loading {
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

    .error-bar {
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

</style>
