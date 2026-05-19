<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import AddStemmaModal from "./components/add_stemma_modal/AddStemmaModal.svelte";
    import FamilySelectionModal from "./components/family_modal/FamilyDetailsModal.svelte";
    import type { GetOrCreateFamily } from "./components/family_modal/FamilyDetailsModal.svelte";
    import PersonSelectionModal from "./components/person_details_modal/PersonDetailsModal.svelte";
    import type { UpdatePerson } from "./components/person_details_modal/PersonDetailsModal.svelte";
    import FullStemma from "./components/FullStemma.svelte";
    import type { StemmaDescription, User, Stemma, PersonDescription, FamilyDescription, Settings } from "./model";
    import { DEFAULT_SETTINGS, ViewMode } from "./model";
    import { StemmaIndex } from "./stemmaIndex";
    import { HiglightLineages } from "./highlight";
    import { PinnedPeopleStorage } from "./pinnedPeopleStorage";
    import RemoveStemmaModal from "./components/delete_stemma_modal/RemoveStemmaModal.svelte";
    import InviteModal from "./components/invite_modal/InviteModal.svelte";
    import type { CreateInviteLink } from "./components/invite_modal/InviteModal.svelte";
    import { Circle2 } from "svelte-loading-spinners";
    import AboutModal from "./components/about/About.svelte";
    import { AppController } from "./appController";
    import CloneStemmaModal from "./components/clone_stemma_modal/CloneStemmaModal.svelte";
    import RenameStemmaModal from "./components/rename_stemma_modal/RenameStemmaModal.svelte";
    import SettingsModal from "./components/settings_modal/SettingsModal.svelte";
    import StatsCard from "./components/stats_card/StatsCard.svelte";
    import { SettingsStorage } from "./settingsStroage";
    import { LocalizedError, t } from "./i18n";
    import { loadCredential, saveCredential } from "./credentialStorage";
    import { onMount, untrack } from "svelte";

    type Props = {
        google_client_id: string;
        stemma_backend_url: string;
    };

    let { google_client_id, stemma_backend_url }: Props = $props();

    let addStemmaModal = $state<ReturnType<typeof AddStemmaModal>>(null);
    let cloneStemmaModal = $state<ReturnType<typeof CloneStemmaModal>>(null);
    let renameStemmaModal = $state<ReturnType<typeof RenameStemmaModal>>(null);
    let removeStemmaModal = $state<ReturnType<typeof RemoveStemmaModal>>(null);
    let familySelectionModal = $state<ReturnType<typeof FamilySelectionModal>>(null);
    let personSelectionModal = $state<ReturnType<typeof PersonSelectionModal>>(null);
    let stemmaChart = $state<ReturnType<typeof FullStemma>>(null);
    let inviteModal = $state<ReturnType<typeof InviteModal>>(null);
    let aboutModal = $state<ReturnType<typeof AboutModal>>(null);
    let settingsModal = $state<ReturnType<typeof SettingsModal>>(null);

    let signedIn = $state(false);

    let ownedStemmas = $state<StemmaDescription[]>(null);
    let currentStemmaId = $state<string>(null);
    let stemma = $state<Stemma>(null);
    let stemmaIndex = $state<StemmaIndex>(null);
    let highlight = $state<HiglightLineages>(null);
    let pinnedPeople = $state<PinnedPeopleStorage>(null);
    let isWorking = $state<boolean>(false);
    let error = $state<Error>(null);
    let settingsStorage = $state<SettingsStorage>(null);
    let settings = $state<Settings>(DEFAULT_SETTINGS);
    let highlightVersion = $state(0);

    const controller = new AppController(untrack(() => stemma_backend_url));

    controller.currentStemmaId.subscribe((s) => (currentStemmaId = s));
    controller.stemma.subscribe((s) => (stemma = s));
    controller.ownedStemmas.subscribe((os) => (ownedStemmas = os));
    controller.stemmaIndex.subscribe((si) => (stemmaIndex = si));
    controller.highlight.subscribe((hg) => (highlight = hg));
    controller.pinnedStorage.subscribe((pp) => (pinnedPeople = pp));
    controller.isWorking.subscribe((iw) => (isWorking = iw));
    controller.err.subscribe((e) => (error = e));
    controller.settingsStorage.subscribe((ss) => {
        settingsStorage = ss;
        if (ss) settings = ss.get();
    });
    controller.invitationToken.subscribe((it) => {
        if (inviteModal) inviteModal.setInviteLink(it);
    });

    function errorMessage(err: Error) {
        if (err instanceof LocalizedError) return $t(err.key, err.params);
        return err.message;
    }

    function handleSignIn(user: User) {
        saveCredential(user.id_token);

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("inviteToken")) {
            const token = urlParams.get("inviteToken");
            urlParams.delete("inviteToken");
            window.history.pushState({}, document.title, window.location.pathname);

            controller.authenticateAndBearToken(user, token);
        } else {
            controller.authenticateAndListStemmas(user);
        }

        signedIn = true;
    }

    onMount(() => {
        const e2eAutoLoginEnabled = typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1";
        if (e2eAutoLoginEnabled) {
            handleSignIn({ id_token: "e2e-user@stemma.local" } as User);
            return;
        }

        const cached = loadCredential();
        if (cached) {
            handleSignIn({ id_token: cached.token });
        }
    });
</script>

{#if signedIn}
    <AddStemmaModal bind:this={addStemmaModal} onstemmaAdded={(name) => controller.addStemma(name)} />
    <RemoveStemmaModal bind:this={removeStemmaModal} onstemmaRemoved={(id) => controller.removeStemma(id)} />
    <CloneStemmaModal bind:this={cloneStemmaModal} onstemmaCloned={(p) => controller.cloneStemma(p.name, p.stemmaId)} />
    <RenameStemmaModal bind:this={renameStemmaModal} onstemmaRenamed={(p) => controller.renameStemma(p.stemmaId, p.name)} />
    <SettingsModal
        bind:this={settingsModal}
        onsettingsChanged={(s) => {
            settings = s;
            settingsStorage.store(s);
        }}
    />

    <FamilySelectionModal
        bind:this={familySelectionModal}
        {stemma}
        {stemmaIndex}
        onfamilyAdded={(p) => controller.createFamily(p.parents, p.children)}
        onfamilyUpdated={(p) => controller.updateFamily(p.familyId, p.parents, p.children)}
        onfamilyRemoved={(id) => controller.removeFamily(id)}
    />

    <PersonSelectionModal
        bind:this={personSelectionModal}
        onpersonRemoved={(id) => controller.removePerson(id)}
        onpersonUpdated={(p) => controller.updatePerson(p.id, p.description, p.pin)}
    />

    <InviteModal bind:this={inviteModal} {stemma} {stemmaIndex} oninvite={(p) => controller.createInvitationToken(p.personId, p.email)} />
    <AboutModal bind:this={aboutModal} />

    <Navbar
        {ownedStemmas}
        {currentStemmaId}
        disabled={isWorking}
        people={stemma ? stemma.people : []}
        onselectStemma={(id) => controller.selectStemma(id)}
        oncreateNewStemma={() => addStemmaModal.promptNewStemma()}
        oncloneStemma={(id) => cloneStemmaModal.promptStemmaClone(id)}
        onrenameStemma={(s) => renameStemmaModal.promptStemmaRename(s.id, s.name)}
        oncreateNewFamily={() => familySelectionModal.promptNewFamily()}
        onremoveStemma={(s) => removeStemmaModal.askForConfirmation(s)}
        oninvite={() => inviteModal.showInvintation()}
        onabout={() => aboutModal.show()}
        onsettings={() => settingsModal.show()}
        onzoomToPerson={(id) => stemmaChart.zoomToNode(id)}
    />

    {#if error}
        <div>
            <div class="alert alert-danger alert-dismissible fade mt-2 mx-2 show">
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label={$t("common.close")}></button>
                <div><strong>{$t('app.oops')} </strong>{errorMessage(error)}</div>
            </div>
        </div>
    {/if}

    {#if isWorking}
        <div class="position-absolute top-50 start-50 translate-middle">
            <Circle2 />
            <p class="mt-2">{$t('app.loading')}</p>
        </div>
    {/if}
    <FullStemma
        bind:this={stemmaChart}
        hidden={isWorking}
        {stemma}
        {currentStemmaId}
        {stemmaIndex}
        {highlight}
        {pinnedPeople}
        viewMode={settings.viewMode}
        onpersonSelected={(p) => personSelectionModal.showPersonDetails({ description: p, pin: pinnedPeople.isPinned(p.id) })}
        onfamilySelected={(f) => familySelectionModal.showExistingFamily(f)}
        onhighlightChanged={() => highlightVersion++}
    />

    {#if !isWorking && stemma && stemmaIndex && highlight}
        <StatsCard {stemma} {stemmaIndex} {highlight} {highlightVersion} />
    {/if}
{:else}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Authenticate {google_client_id} onsignIn={(user) => handleSignIn(user)} />
        </div>
    </div>
{/if}

<style>
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
