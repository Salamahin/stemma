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
    import { cancelGoogleAuth } from "./googleAuth";
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
    import EditGestures from "./components/EditGestures.svelte";
    import LinkPicker from "./components/LinkPicker.svelte";
    import { linkOptions, type LinkOption } from "./ghostLink";
    import EditModeOverlay from "./components/EditModeOverlay.svelte";
    import Chrome from "./components/Chrome.svelte";
    import PendingVisuals from "./components/PendingVisuals.svelte";
    import Minimap from "./components/Minimap.svelte";
    import { capturePendingInvite, takePendingInvite } from "./inviteLinkBuilder";
    import { attachmentsOf } from "./attachments";
    import { Circle2 } from "svelte-loading-spinners";
    import { denormalizeId, normalizeId } from "./graphTools";
    import type { CanvasChart } from "./canvasChart";
    import type { FocusedId } from "./focusGesture";
    import { isPendingId, pendingPersonDescription } from "./pendingState";
    import { MutationActions } from "./mutationActions";
    import { ModalActions } from "./modalActions";
    import { Session, e2eAutoLoginEnabled } from "./session";
    import { forgetSession, hasSessionHint, rememberSession } from "./sessionHint";
    import type { PendingAdd, PendingFamily } from "./pendingState";

    type Props = { google_client_id: string; stemma_backend_url: string };
    let { google_client_id, stemma_backend_url }: Props = $props();

    let editMode = $state(false);
    /** Edit mode: a drag from one person onto another links them (LinkPicker). */
    let linkMode = $state(false);
    let linkPick = $state<{ options: LinkOption[]; x: number; y: number } | null>(null);

    let ownedStemmas = $state<StemmaDescription[]>([]);
    let currentStemmaId = $state<string | null>(null);
    let favouriteStemmaId = $state<string | null>(null);
    let stemma = $state<Stemma | null>(null);
    let stemmaIndex = $state<StemmaIndex | null>(null);
    let highlight = $state<HighlightLineages | null>(null);
    let pinnedPeople = $state<PinnedPeopleStorage | null>(null);
    let isWorking = $state<boolean>(false);
    let error = $state<Error | null>(null);
    let invitationLink = $state<string | null>(null);
    let invitationPending = $state(false);
    let highlightVersion = $state(0);

    let selectedFamilyId = $state<string | null>(null);
    let selectedFamilyEl = $state<{ getBoundingClientRect(): DOMRect } | null>(null);
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
    let chart = $state<CanvasChart | null>(null);
    let minimap = $state<ReturnType<typeof Minimap> | null>(null);

    const controller = new AppController(untrack(() => stemma_backend_url));

    let pendingAdds = $state<PendingAdd[]>([]);
    let pendingFamilies = $state<PendingFamily[]>([]);
    let pendingRemovedPersonIds = $state<Set<string>>(new Set());
    let pendingRemovedFamilyIds = $state<Set<string>>(new Set());
    let signedIn = $state(false);
    let signingIn = $state(false);
    // A cached session is worth waiting for behind a spinner; without one the
    // login screen paints on the first frame and the probe doubles as the
    // backend wake-up call in the background.
    let bootProbing = $state(hasSessionHint() || e2eAutoLoginEnabled());

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
        () => loadStemmasOrSignOut(),
    );

    async function loadStemmasOrSignOut(): Promise<boolean> {
        try {
            await controller.listStemmas();
            return true;
        } catch (err) {
            if ((err as { key?: string }).key === "error.sessionExpired") {
                session.markSignedOut();
                return false;
            }
            error = err as Error;
            console.error("Listing stemmas failed", err);
            // A stale stemma list is no reason to bounce the user back to the
            // login screen; the error bar explains what went wrong.
            return true;
        }
    }

    async function handleGoogleSignIn(idToken: string) {
        fetch(`${stemma_backend_url}/warmup`).catch(() => {});
        signingIn = true;
        try {
            await session.signIn(idToken);
        } catch (err) {
            error = err as Error;
            console.error("Sign-in failed", err);
        } finally {
            signingIn = false;
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
        controller.favouriteStemmaId.subscribe((id) => (favouriteStemmaId = id)),
        controller.stemmaIndex.subscribe((si) => (stemmaIndex = si)),
        controller.highlight.subscribe((hg) => (highlight = hg)),
        controller.pinnedStorage.subscribe((pp) => (pinnedPeople = pp)),
        controller.isWorking.subscribe((iw) => (isWorking = iw)),
        controller.err.subscribe((e) => (error = e)),
        controller.invitationLink.subscribe((link) => (invitationLink = link)),
        controller.invitationPending.subscribe((p) => (invitationPending = p)),
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
        linkMode = false;
        linkPick = null;
        focusedId = null;
        untrack(() => actions.cleanupIncompletePendingFamiliesOnExitEdit());
    });

    // Link mode has no ghosts: entering it clears the focus.
    $effect(() => {
        if (linkMode) focusedId = null;
    });

    function linkDrop(fromId: string, toId: string, clientX: number, clientY: number) {
        if (!displayedStemmaIndex) return;
        const options = linkOptions(displayedStemmaIndex, denormalizeId(fromId), denormalizeId(toId));
        if (options.length > 0) linkPick = { options, x: clientX, y: clientY };
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
        const nodeId = normalizeId("family", family.id);
        const c = chart;
        selectedFamilyEl = c ? { getBoundingClientRect: () => c.nodeClientRect(nodeId) } : null;
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
            rememberSession();
            signedIn = true;
            cancelGoogleAuth();
        } catch (err) {
            if (signedIn) return;
            // The 401 itself woke the backend up, so no separate warmup here.
            if ((err as { key?: string }).key === "error.sessionExpired") {
                forgetSession();
                return;
            }
            error = err as Error;
        }
    }

    // An invite link may be opened signed out: keep the token across sign-in
    // and accept it once the session is up.
    capturePendingInvite(
        window.location.href,
        (url) => window.history.replaceState(window.history.state, "", url),
        window.sessionStorage,
    );

    $effect(() => {
        if (!signedIn) return;
        const token = takePendingInvite(window.sessionStorage);
        if (token) untrack(() => void controller.bearInvitationToken(token));
    });

    onMount(() => {
        const boot = session.e2eAutoLoginEnabled
            ? session.signInAsE2eUser()
            : probeCookieSession();
        void Promise.resolve(boot).finally(() => (bootProbing = false));
        return () => {
            for (const unsub of subscriptions) unsub();
        };
    });

    const showCanvas = $derived(!isWorking && displayedStemma && displayedStemmaIndex && highlight && pinnedPeople);
    const showEmpty = $derived(!isWorking && stemma && stemma.people.length === 0);
</script>

{#if signedIn}
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
                    onchartReady={(c) => (chart = c)}
                />
            {/if}

            {#if showEmpty}
                <EmptyState {editMode} onaddPerson={() => modals.addPerson()} />
            {/if}
        </div>

        <FocusController
            {editMode}
            {chart}
            {ghostSimPositions}
            {focusedId}
            onfocusChange={(f) => (focusedId = f)}
        />
        <GhostLayer
            focusedId={linkMode ? null : focusedId}
            stemmaIndex={displayedStemmaIndex}
            {chart}
            getLayoutCenter={() => stemmaChart?.getLayoutCenter() ?? [window.innerWidth / 2, window.innerHeight / 2]}
            onghostClick={(kind, focused, pins, existingFamilyId) => actions.onGhostClick(kind, focused, pins, existingFamilyId)}
            onpositionsChange={(p) => (ghostSimPositions = p)}
        />
        <EditGestures
            {editMode}
            {linkMode}
            {chart}
            canLink={(a, b) => !!displayedStemmaIndex && linkOptions(displayedStemmaIndex, denormalizeId(a), denormalizeId(b)).length > 0}
            popHover={() => stemmaChart?.popHover()}
            onshortTapFocus={(f) => (focusedId = f)}
            onlongPress={handleNodeActivation}
            ondesktopNodeClick={handleNodeActivation}
            onclearFocus={() => (focusedId = null)}
            onnodeMoved={(nodeId, x, y) => stemmaChart?.placeNode(nodeId, x, y)}
            onlinkDrop={linkDrop}
            onexitLinkMode={() => (linkMode = false)}
        />
        {#if editMode && linkMode}
            <div class="link-hint" aria-live="polite" data-testid="link-hint">
                <i class="bi bi-share"></i> {$t("link.hint")}
            </div>
        {/if}
        {#if linkPick && displayedStemmaIndex}
            <LinkPicker
                options={linkPick.options}
                index={displayedStemmaIndex}
                x={linkPick.x}
                y={linkPick.y}
                onpick={(o) => { linkPick = null; actions.linkPeople(o); }}
                oncancel={() => (linkPick = null)}
            />
        {/if}
        <PendingVisuals
            adds={pendingAdds}
            families={pendingFamilies}
            removedPersonIds={pendingRemovedPersonIds}
            removedFamilyIds={pendingRemovedFamilyIds}
            {chart}
        />

        <Minimap
            bind:this={minimap}
            {editMode}
            {chart}
            getZoomTransform={() => stemmaChart?.getZoomTransform() ?? null}
            applyZoomTranslate={(tx, ty) => stemmaChart?.applyZoomTranslate(tx, ty)}
        />

        <Chrome
            {ownedStemmas}
            {currentStemmaId}
            {favouriteStemmaId}
            {isWorking}
            {stemma}
            {stemmaIndex}
            {highlight}
            {highlightVersion}
            {editMode}
            {linkMode}
            showSignOut={!session.e2eAutoLoginEnabled}
            onstemmaSelect={(id) => controller.selectStemma(id)}
            onstemmaAddNew={() => modals.addStemma()}
            onstemmaRename={(s) => modals.renameStemma(s)}
            onstemmaClone={(s) => modals.cloneStemma(s)}
            onstemmaRemove={(s) => modals.removeStemma(s)}
            onstemmaFavourite={(s) => controller.toggleFavouriteStemma(s.id)}
            onsearchSelect={(id) => stemmaChart?.zoomToNode(id)}
            onabout={() => aboutModal?.show()}
            onsettings={() => settingsModal?.show()}
            onexport={() => stemmaChart?.exportSvg($t("nav.exportDefaultName"))}
            onexportPng={() => stemmaChart?.exportPng($t("nav.exportDefaultName")).catch((e) => console.error("PNG export failed", e))}
            onsignOut={() => session.signOut()}
            oneditToggle={() => { editMode = !editMode; }}
            onlinkToggle={() => { linkMode = !linkMode; }}
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
                attachments={selectedFamilyId ? attachmentsOf(stemma, "family", selectedFamilyId) : []}
                onattachLink={(p) => controller.attachLink("family", p.familyId, p.title, p.url, p.note)}
                onattachFile={(p) => controller.attachFile("family", p.familyId, p.file, p.title)}
                onremoveAttachment={(id) => controller.removeAttachment(id)}
            />
        {/snippet}
    </Sheet>

    <PersonDetailsModal
        bind:this={personEditModal}
        {editMode}
        onpersonUpdated={(p) => controller.savePerson(p.id, p.description, p.pin, p.photoUpload, p.photoRemove)}
        onpersonRemoveRequested={(p) => modals.confirmRemovePerson(p)}
        onshareAccessRequested={(p) => shareAccessModal?.show(p)}
        attachmentsOf={(personId) => attachmentsOf(stemma, "person", personId)}
        onattachLink={(p) => controller.attachLink("person", p.personId, p.title, p.url, p.note)}
        onattachFile={(p) => controller.attachFile("person", p.personId, p.file, p.title)}
        onremoveAttachment={(id) => controller.removeAttachment(id)}
    />

    <AboutModal bind:this={aboutModal} />
    <SettingsModal bind:this={settingsModal} />
    <ShareAccessModal
        bind:this={shareAccessModal}
        link={invitationLink}
        pending={invitationPending}
        oncreate={(p) => controller.createInvitationToken(p.personId, p.email)}
    />
    <PromptModal bind:this={promptModal} />
    <ConfirmModal bind:this={confirmModal} />
{:else if bootProbing || signingIn}
    <div class="boot-loading vh-100">
        <Circle2 />
        <p class="mt-2">{$t("app.loading")}</p>
    </div>
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
        height: 100vh;
        height: 100dvh;
        touch-action: none;
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

    .boot-loading {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: #f8f9fa;
    }

    .link-hint {
        position: fixed;
        left: 50%;
        bottom: 24px;
        transform: translateX(-50%);
        z-index: 900;
        background: rgba(13, 110, 253, 0.95);
        color: #fff;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.85rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        pointer-events: none;
        max-width: calc(100vw - 32px);
        text-align: center;
    }
</style>
