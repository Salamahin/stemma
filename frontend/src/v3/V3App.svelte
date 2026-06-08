<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { AppController } from "../appController";
    import type {
        FamilyDescription,
        PersonDescription,
        Stemma,
        StemmaDescription,
        User,
    } from "../model";
    import { StemmaIndex } from "../stemmaIndex";
    import { HiglightLineages } from "../highlight";
    import { PinnedPeopleStorage } from "../pinnedPeopleStorage";
    import { ViewMode } from "../model";
    import { LocalizedError, t } from "../i18n";
    import { initializeGoogleAuth } from "../googleAuth";
    import Authenticate from "../components/Authenticate.svelte";
    import FullStemma from "../components/FullStemma.svelte";
    import V3Sheet from "./components/V3Sheet.svelte";
    import V3FamilyCard from "./components/V3FamilyCard.svelte";
    import V3EmptyState from "./components/V3EmptyState.svelte";
    import V3AboutModal from "./components/V3AboutModal.svelte";
    import V3SettingsModal from "./components/V3SettingsModal.svelte";
    import V3ShareAccessModal from "./components/V3ShareAccessModal.svelte";
    import V3PromptModal from "./components/V3PromptModal.svelte";
    import V3ConfirmModal from "./components/V3ConfirmModal.svelte";
    import V3PersonDetailsModal from "./components/V3PersonDetailsModal.svelte";
    import V3FocusController from "./components/V3FocusController.svelte";
    import V3GhostLayer from "./components/V3GhostLayer.svelte";
    import V3DragGestures from "./components/V3DragGestures.svelte";
    import V3EditModeOverlay from "./components/V3EditModeOverlay.svelte";
    import V3Chrome from "./components/V3Chrome.svelte";
    import V3PendingVisuals from "./components/V3PendingVisuals.svelte";
    import { buildInviteLink } from "../inviteLinkBuilder";
    import { Circle2 } from "svelte-loading-spinners";
    import { normalizeId } from "../graphTools";
    import type { FocusedId } from "./focusGesture";
    import { isPendingId, pendingPersonDescription } from "./pendingState";
    import { V3MutationActions } from "./v3MutationActions";
    import { V3ModalActions } from "./v3ModalActions";
    import { V3Session } from "./v3Session";
    import type { PendingAdd, PendingFamily } from "./pendingState";

    type SourceRef = { kind: "person"; id: string } | { kind: "family"; id: string } | { kind: "empty" };

    type Props = { google_client_id: string; stemma_backend_url: string };
    let { google_client_id, stemma_backend_url }: Props = $props();

    let editMode = $state(false);
    let panMode = $state(false);
    let spacePan = $state(false);
    const panActive = $derived(editMode && (panMode || spacePan));
    let trayOpen = $state(false);

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
    let activeGestureSource = $state<SourceRef | null>(null);
    let focusedId = $state<FocusedId | null>(null);
    let ghostSimPositions = $state<Array<{ x: number; y: number }>>([]);

    let personEditModal = $state<ReturnType<typeof V3PersonDetailsModal> | null>(null);
    let aboutModal = $state<ReturnType<typeof V3AboutModal> | null>(null);
    let settingsModal = $state<ReturnType<typeof V3SettingsModal> | null>(null);
    let shareAccessModal = $state<ReturnType<typeof V3ShareAccessModal> | null>(null);
    let promptModal = $state<ReturnType<typeof V3PromptModal> | null>(null);
    let confirmModal = $state<ReturnType<typeof V3ConfirmModal> | null>(null);
    let stemmaChart = $state<ReturnType<typeof FullStemma> | null>(null);

    const controller = new AppController(untrack(() => stemma_backend_url));

    let pendingAdds = $state<PendingAdd[]>([]);
    let pendingFamilies = $state<PendingFamily[]>([]);
    let pendingRemovedPersonIds = $state<Set<string>>(new Set());
    let pendingRemovedFamilyIds = $state<Set<string>>(new Set());
    let signedIn = $state(false);

    const actions = new V3MutationActions({
        controller,
        getStemmaIndex: () => stemmaIndex,
        getStemmaChart: () => stemmaChart,
        getPersonEditModal: () => personEditModal,
        addsRef: { get: () => pendingAdds, set: (v) => (pendingAdds = v) },
        familiesRef: { get: () => pendingFamilies, set: (v) => (pendingFamilies = v) },
        removedPersonIdsRef: { get: () => pendingRemovedPersonIds, set: (v) => (pendingRemovedPersonIds = v) },
        removedFamilyIdsRef: { get: () => pendingRemovedFamilyIds, set: (v) => (pendingRemovedFamilyIds = v) },
    });

    const modals = new V3ModalActions({
        controller,
        actions,
        getPromptModal: () => promptModal,
        getConfirmModal: () => confirmModal,
        getPersonModal: () => personEditModal,
    });

    const session = new V3Session(
        { get: () => signedIn, set: (v) => (signedIn = v) },
        {
            onSignIn: () => controller.authenticateAndListStemmas(session.tokenProvider),
            onSignOut: () => {},
        },
    );

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

    const orphanPeople = $derived.by<PersonDescription[]>(() => {
        if (!stemma || !stemmaIndex) return [];
        return stemma.people.filter((p) => stemmaIndex!.relatedFamilies(p.id).length === 0);
    });

    $effect(() => {
        if (editMode) return;
        panMode = false;
        spacePan = false;
        untrack(() => actions.cleanupIncompletePendingFamiliesOnExitEdit());
    });

    // Pan activation clears focus so ghosts dismiss before canvas drag.
    $effect(() => {
        if (panActive) focusedId = null;
    });

    async function handleBulkAdd(names: string[]) {
        for (const name of names) {
            await actions.withPendingAdd(name, () =>
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

    onMount(() => {
        if (session.e2eAutoLoginEnabled) {
            session.enableE2eMode();
            const override = (window as unknown as { __STEMMA_E2E_USER__?: string }).__STEMMA_E2E_USER__;
            session.handleSignIn({ id_token: override || "e2e-user@stemma.local" } as User);
        } else {
            initializeGoogleAuth(google_client_id).catch((err) => console.error("Google Identity init failed", err));
            if (session.initialCached) {
                session.handleSignIn({ id_token: session.initialCached.token });
            } else {
                fetch(`${stemma_backend_url}/warmup`).catch(() => {});
            }
        }
        return () => {
            for (const unsub of subscriptions) unsub();
            session.teardown();
        };
    });

    const showCanvas = $derived(!isWorking && displayedStemma && displayedStemmaIndex && highlight && pinnedPeople);
    const showEmpty = $derived(!isWorking && stemma && stemma.people.length === 0);
</script>

{#if signedIn}
    <div class="v3-layout" class:v3-edit-mode={editMode}>
        <V3EditModeOverlay {editMode} />

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
                <V3EmptyState {editMode} onaddPerson={() => modals.addPerson()} />
            {/if}
        </div>

        <V3FocusController
            {editMode}
            stemmaChartReady={!!stemmaChart}
            {ghostSimPositions}
            {focusedId}
            onfocusChange={(f) => (focusedId = f)}
        />
        <V3GhostLayer
            {focusedId}
            stemmaIndex={displayedStemmaIndex}
            stemmaChartReady={!!stemmaChart}
            onghostClick={(kind, focused, pos) => actions.onGhostClick(kind, focused, pos)}
            onpositionsChange={(p) => (ghostSimPositions = p)}
        />
        <V3DragGestures
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
            onactiveGestureSource={(src) => (activeGestureSource = src)}
            onshortTapFocus={(f) => (focusedId = f)}
            onclearFocus={() => (focusedId = null)}
            onclosePanMode={() => (panMode = false)}
            onspacePanChange={(v) => (spacePan = v)}
        />
        <V3PendingVisuals
            adds={pendingAdds}
            families={pendingFamilies}
            removedPersonIds={pendingRemovedPersonIds}
            removedFamilyIds={pendingRemovedFamilyIds}
            stemmaChartReady={!!stemmaChart}
        />

        <V3Chrome
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
            {orphanPeople}
            {trayOpen}
            onstemmaSelect={(id) => controller.selectStemma(id)}
            onstemmaAddNew={() => modals.addStemma()}
            onstemmaRename={(s) => modals.renameStemma(s)}
            onstemmaClone={(s) => modals.cloneStemma(s)}
            onstemmaRemove={(s) => modals.removeStemma(s)}
            onsearchSelect={(id) => stemmaChart?.zoomToNode(id)}
            onabout={() => aboutModal?.show()}
            onsettings={() => settingsModal?.show()}
            onexport={() => stemmaChart?.exportSvg($t("nav.exportDefaultName"))}
            onsignOut={() => session.endSession()}
            oneditToggle={() => { editMode = !editMode; }}
            onpanToggle={() => { panMode = !panMode; }}
            onaddPerson={() => modals.addPerson()}
            onbulkAdd={handleBulkAdd}
            ontrayToggle={() => { trayOpen = !trayOpen; }}
        />

        {#if isWorking}
            <div class="v3-loading">
                <Circle2 />
                <p class="mt-2">{$t("app.loading")}</p>
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
                onfamilyRemoveRequested={(id) => modals.confirmRemoveFamily(id)}
                onclose={closeFamilySheet}
            />
        {/snippet}
    </V3Sheet>

    <V3PersonDetailsModal
        bind:this={personEditModal}
        {editMode}
        onpersonUpdated={(p) => controller.savePerson(p.id, p.description, p.pin, p.photoUpload, p.photoRemove)}
        onpersonRemoveRequested={(p) => modals.confirmRemovePerson(p)}
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
            <Authenticate {google_client_id} onsignIn={(user) => session.handleSignIn(user)} />
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

    .v3-edit-mode :global(g[id^='person_']),
    .v3-edit-mode :global(g[id^='family_']) {
        cursor: grab;
    }
</style>
