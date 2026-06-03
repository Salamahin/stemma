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
    import About from "../components/about/About.svelte";
    import SettingsModal from "../components/settings_modal/SettingsModal.svelte";
    import PersonDetailsModal from "../components/person_details_modal/PersonDetailsModal.svelte";
    import V2Chip from "./components/V2Chip.svelte";
    import V2Menu from "./components/V2Menu.svelte";
    import V2Fab from "./components/V2Fab.svelte";
    import V2EditPill from "./components/V2EditPill.svelte";
    import V2EmptyState from "./components/V2EmptyState.svelte";
    import V2Sheet from "./components/V2Sheet.svelte";
    import V2PersonCard from "./components/V2PersonCard.svelte";
    import V2FamilyCard from "./components/V2FamilyCard.svelte";
    import V2NameModal from "./components/V2NameModal.svelte";
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

    let selectedPerson = $state<PersonDescription | null>(null);
    let selectedPersonEl = $state<Element | null>(null);
    let personSheetOpen = $state(false);

    let selectedFamilyId = $state<string | null>(null);
    let selectedFamilyStub = $state<StubContext | null>(null);
    let selectedFamilyEl = $state<Element | null>(null);
    let familySheetOpen = $state(false);

    let v2NameModal = $state<ReturnType<typeof V2NameModal> | null>(null);
    let personEditModal = $state<ReturnType<typeof PersonDetailsModal> | null>(null);
    let aboutModal = $state<ReturnType<typeof About> | null>(null);
    let settingsModal = $state<ReturnType<typeof SettingsModal> | null>(null);
    let stemmaChart = $state<ReturnType<typeof FullStemma> | null>(null);

    const controller = new AppController(untrack(() => stemma_backend_url));

    controller.currentStemmaId.subscribe((s) => (currentStemmaId = s));
    controller.stemma.subscribe((s) => {
        stemma = s;
        stubFamilies = new Map();
    });
    controller.ownedStemmas.subscribe((os) => (ownedStemmas = os));
    controller.stemmaIndex.subscribe((si) => (stemmaIndex = si));
    controller.highlight.subscribe((hg) => (highlight = hg));
    controller.pinnedStorage.subscribe((pp) => (pinnedPeople = pp));
    controller.isWorking.subscribe((iw) => (isWorking = iw));
    controller.err.subscribe((e) => (error = e));

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

    // Auth / token refresh
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

    onMount(() => {
        if (e2eAutoLoginEnabled) {
            e2eMode = true;
            handleSignIn({ id_token: "e2e-user@stemma.local" } as User);
            return;
        }

        initializeGoogleAuth(google_client_id).catch((err) => console.error("Google Identity init failed", err));

        if (initialCached) {
            handleSignIn({ id_token: initialCached.token });
        } else {
            fetch(`${stemma_backend_url}/warmup`).catch(() => {});
        }
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
                />
            {/if}

            {#if showEmpty}
                <V2EmptyState {editMode} onaddPerson={() => v2NameModal?.prompt()} />
            {/if}
        </div>

        <div class="v2-chrome" aria-hidden="false">
            <div class="v2-top-left">
                <V2Chip
                    {ownedStemmas}
                    {currentStemmaId}
                    disabled={isWorking}
                    onstemmaSelect={(id) => controller.selectStemma(id)}
                />
            </div>

            {#if editMode}
                <div class="v2-top-center">
                    <V2EditPill />
                </div>
            {/if}

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
                    onaddPerson={() => v2NameModal?.prompt()}
                />
            </div>
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
                onclose={closeFamilySheet}
            />
        {/snippet}
    </V2Sheet>

    <V2NameModal
        bind:this={v2NameModal}
        onconfirm={(name) => controller.createOrphanPerson({ type: "CreateNewPerson", name })}
    />

    <PersonDetailsModal
        bind:this={personEditModal}
        onpersonUpdated={(p) => controller.savePerson(p.id, p.description, p.pin, p.photoUpload, p.photoRemove)}
        onpersonRemoved={(id) => controller.removePerson(id)}
    />

    <About bind:this={aboutModal} />
    <SettingsModal bind:this={settingsModal} />
{:else}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Authenticate {google_client_id} onsignIn={(user) => handleSignIn(user)} />
        </div>
    </div>
{/if}

<style>
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
        pointer-events: none;
        z-index: 100;
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
