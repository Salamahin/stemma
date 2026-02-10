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
    import SettingsModal from "./components/settings_modal/SettingsModal.svelte";
    import { SettingsStorage } from "./settingsStroage";
    import { LocalizedError, t } from "./i18n";
    import { jwtDecode } from "jwt-decode";
    import { onMount } from "svelte";

    export let google_client_id;
    export let stemma_backend_url;

    const CREDENTIAL_KEY = "stemma_credential";

    let addStemmaModal;
    let cloneStemmaModal;
    let removeStemmaModal;
    let familySelectionModal;
    let personSelectionModal;
    let stemmaChart;
    let inviteModal;
    let aboutModal;
    let settingsModal;

    let signedIn = false;

    let ownedStemmas: StemmaDescription[];
    let currentStemmaId: string;
    let stemma: Stemma;
    let stemmaIndex: StemmaIndex;
    let highlight: HiglightLineages;
    let pinnedPeople: PinnedPeopleStorage;
    let isWorking: boolean;
    let error: Error;
    let settingsStorage: SettingsStorage;
    let settings: Settings = DEFAULT_SETTINGS;

    let controller = new AppController(stemma_backend_url);

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
        if (settingsStorage) settings = ss.get();
    });
    controller.invitationToken.subscribe((it) => {
        if (inviteModal) inviteModal.setInviteLink(it);
    });

    function errorMessage(err: Error) {
        if (err instanceof LocalizedError) return $t(err.key, err.params);
        return err.message;
    }

    function handleSignIn(user: User) {
        sessionStorage.setItem(CREDENTIAL_KEY, user.id_token);

        let urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("inviteToken")) {
            let token = urlParams.get("inviteToken");
            urlParams.delete("inviteToken");
            window.history.pushState({}, document.title, window.location.pathname);

            controller.authenticateAndBearToken(user, token);
        } else {
            controller.authenticateAndListStemmas(user);
        }

        signedIn = true;
    }

    onMount(() => {
        try {
            const credential = sessionStorage.getItem(CREDENTIAL_KEY);
            if (credential) {
                const decoded: any = jwtDecode(credential);
                if (decoded.exp * 1000 > Date.now()) {
                    handleSignIn({ id_token: credential });
                }
            }
        } catch (e) {
            sessionStorage.removeItem(CREDENTIAL_KEY);
        }
    });

</script>

{#if signedIn}
    <AddStemmaModal bind:this={addStemmaModal} on:stemmaAdded={(e) => controller.addStemma(e.detail)} />
    <RemoveStemmaModal bind:this={removeStemmaModal} on:stemmaRemoved={(e) => controller.removeStemma(e.detail)} />
    <CloneStemmaModal bind:this={cloneStemmaModal} on:stemmaCloned={(e) => controller.cloneStemma(e.detail.name, e.detail.stemmaId)} />
    <SettingsModal
        bind:this={settingsModal}
        on:settingsChanged={(e) => {
            settings = e.detail;
            settingsStorage.store(settings);
        }}
    />

    <FamilySelectionModal
        bind:this={familySelectionModal}
        {stemma}
        {stemmaIndex}
        on:familyAdded={(e) => controller.createFamily(e.detail.parents, e.detail.children)}
        on:familyUpdated={(e) => controller.updateFamily(e.detail.familyId, e.detail.parents, e.detail.children)}
        on:familyRemoved={(e) => controller.removeFamily(e.detail)}
    />

    <PersonSelectionModal
        bind:this={personSelectionModal}
        on:personRemoved={(e) => controller.removePerson(e.detail)}
        on:personUpdated={(e) => controller.updatePerson(e.detail.id, e.detail.description, e.detail.pin)}
    />

    <InviteModal bind:this={inviteModal} {stemma} {stemmaIndex} on:invite={(e) => controller.createInvitationToken(e.detail.personId, e.detail.email)} />
    <AboutModal bind:this={aboutModal} />

    <Navbar
        {ownedStemmas}
        {currentStemmaId}
        disabled={isWorking}
        people={stemma ? stemma.people : []}
        on:selectStemma={(e) => controller.selectStemma(e.detail)}
        on:createNewStemma={() => addStemmaModal.promptNewStemma()}
        on:cloneStemma={(e) => cloneStemmaModal.promptStemmaClone(e.detail)}
        on:createNewFamily={() => familySelectionModal.promptNewFamily()}
        on:removeStemma={(e) => removeStemmaModal.askForConfirmation(e.detail)}
        on:invite={() => inviteModal.showInvintation()}
        on:about={() => aboutModal.show()}
        on:settings={() => settingsModal.show()}
        on:zoomToPerson={(e) => stemmaChart.zoomToNode(e.detail)}
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
        on:personSelected={(e) => personSelectionModal.showPersonDetails({ description: e.detail, pin: pinnedPeople.isPinned(e.detail.id) })}
        on:familySelected={(e) => familySelectionModal.showExistingFamily(e.detail)}
    />
{:else}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Authenticate {google_client_id} on:signIn={(e) => handleSignIn(e.detail)} />
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
