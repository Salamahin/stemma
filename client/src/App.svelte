<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import AddStemmaModal from "./components/add_stemma_modal/AddStemmaModal.svelte";
    import FamilySelectionModal, { GetOrCreateFamily } from "./components/family_modal/FamilyDetailsModal.svelte";
    import PersonSelectionModal, { UpdatePerson } from "./components/person_details_modal/PersonDetailsModal.svelte";
    import FullStemma from "./components/FullStemma.svelte";
    import { Model, StemmaDescription, User, Stemma, PersonDescription, FamilyDescription } from "./model";
    import { StemmaIndex } from "./stemmaIndex";
    import { HiglightLineages } from "./highlight";
    import { PinnedPeopleStorage } from "./pinnedPeopleStorage";
    import fuzzysort from "fuzzysort";
    import RemoveStemmaModal from "./components/delete_stemma_modal/RemoveStemmaModal.svelte";
    import InviteModal, { CreateInviteLink } from "./components/invite_modal/InviteModal.svelte";
    import { Circle2 } from "svelte-loading-spinners";
    import AboutModal from "./components/about/About.svelte";
    import { Stores as AppController } from "./appStores";

    export let google_client_id;
    export let stemma_backend_url;

    let addStemmaModal;
    let familySelectionModal;
    let personSelectionModal;
    let stemmaChart;
    let removeStemmaModal;
    let inviteModal;
    let aboutModal;

    let signedIn = false;

    let ownedStemmasDescriptions: StemmaDescription[];
    let selectedStemmaDescription: StemmaDescription;
    let selectedStemma: Stemma;
    let stemmaIndex: StemmaIndex;
    let lookupPersonName;
    let highlight: HiglightLineages;
    let pinnedPeople: PinnedPeopleStorage;

    let contoller = new AppController(stemma_backend_url);

    function handleSignIn(user: User) {
        console.log("handle sign in");

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("inviteToken")) {
            let token = urlParams.get("inviteToken");
            urlParams.delete("inviteToken");
            window.history.pushState({}, document.title, window.location.pathname);

            contoller.authenticateAndBearToken(user, token);
        } else {
            contoller.authenticateAndListStemmas(user);
        }

        signedIn = true;
    }

    function handleNewStemma(name: string) {
        waiting = model.addStemma(name).then((newStemmaDescription) => {
            ownedStemmasDescriptions = [...ownedStemmasDescriptions, newStemmaDescription];
            selectedStemmaDescription = newStemmaDescription;
        });
    }

    function handleNewFamilyCreation(request: GetOrCreateFamily) {
        waiting = model.createFamily(selectedStemmaDescription.id, request.parents, request.children, stemmaIndex).then((s) => (selectedStemma = s));
    }

    function hadlePersonUpdated(request: UpdatePerson) {
        pinnedPeople = request.pin ? pinnedPeople.add(request.id) : pinnedPeople.remove(request.id);

        let originalPerson = stemmaIndex.person(request.id);

        if (
            originalPerson.birthDate != request.description.birthDate ||
            originalPerson.deathDate != request.description.deathDate ||
            originalPerson.name != request.description.name ||
            originalPerson.bio != request.description.bio
        ) {
            waiting = model.updatePerson(selectedStemmaDescription.id, request.id, request.description, stemmaIndex).then((s) => (selectedStemma = s));
        }
    }

    function handleFamilyUpdated(request: GetOrCreateFamily) {
        waiting = model
            .updateFamily(selectedStemmaDescription.id, request.familyId, request.parents, request.children, stemmaIndex)
            .then((s) => (selectedStemma = s));
    }

    function handleFamilyRemoved(familyId: string) {
        waiting = model.removeFamily(selectedStemmaDescription.id, familyId).then((s) => (selectedStemma = s));
    }

    function handlePersonRemoved(personId: string) {
        waiting = model.removePerson(selectedStemmaDescription.id, personId, stemmaIndex).then((s) => (selectedStemma = s));
        pinnedPeople = pinnedPeople.remove(personId);
    }

    function handlePersonSelection(personDetails: PersonDescription) {
        personSelectionModal.showPersonDetails({ description: personDetails, pin: pinnedPeople.isPinned(personDetails.id) });
    }

    function handleFamilySelection(familyDetails: FamilyDescription) {
        familySelectionModal.showExistingFamily(familyDetails);
    }

    function handleStemmaRemoval(stemmaId) {
        waiting = model.removeStemma(stemmaId).then((st) => (ownedStemmasDescriptions = st.stemmas));
    }

    function handleInvitationCreation(e: CreateInviteLink) {
        waiting = model.createInvintation(selectedStemmaDescription.id, e.personId, e.email, stemmaIndex).then((link) => inviteModal.setInviteLink(link));
    }

    function updateEverythingOnStemmaChange(stemmaId: string, stemma: Stemma) {
        let pp = new PinnedPeopleStorage(stemmaId);
        pp.load();

        let si = new StemmaIndex(stemma);
        let hg = new HiglightLineages(si, pp.allPinned());

        return { si, pp, hg };
    }

    function updateHighlightOnPinnedPeopleChange(pp: PinnedPeopleStorage) {
        let hg = new HiglightLineages(stemmaIndex, pp.allPinned());
        return hg;
    }

    function updateIndexAndHighlightOnStemmaChange(stemma: Stemma) {
        let si = new StemmaIndex(stemma);
        let hg = new HiglightLineages(si, pinnedPeople.allPinned());

        return { si, hg };
    }

    $: if (selectedStemmaDescription && signedIn) {
        waiting = model.getStemma(selectedStemmaDescription.id).then((s) => {
            let { si, pp, hg } = updateEverythingOnStemmaChange(selectedStemmaDescription.id, s);
            selectedStemma = s;
            stemmaIndex = si;
            pinnedPeople = pp;
            highlight = hg;
        });
    }

    $: if (selectedStemma) {
        let { si, hg } = updateIndexAndHighlightOnStemmaChange(selectedStemma);
        stemmaIndex = si;
        highlight = hg;
    }

    $: if (pinnedPeople) highlight = updateHighlightOnPinnedPeopleChange(pinnedPeople);

    $: if (lookupPersonName && stemmaChart) {
        let results = fuzzysort.go(lookupPersonName, selectedStemma.people, { key: "name" });
        if (results.length) stemmaChart.zoomToNode(results[0].obj.id);
    }

    $: console.log(`signedIn ${signedIn}`);
</script>

{#if signedIn}
    <AddStemmaModal bind:this={addStemmaModal} on:stemmaAdded={(e) => handleNewStemma(e.detail)} />

    <RemoveStemmaModal bind:this={removeStemmaModal} on:stemmaRemoved={(e) => handleStemmaRemoval(e.detail)} />

    <FamilySelectionModal
        bind:this={familySelectionModal}
        stemma={selectedStemma}
        {stemmaIndex}
        on:familyAdded={(e) => handleNewFamilyCreation(e.detail)}
        on:familyUpdated={(e) => handleFamilyUpdated(e.detail)}
        on:familyRemoved={(e) => handleFamilyRemoved(e.detail)}
    />

    <PersonSelectionModal
        bind:this={personSelectionModal}
        on:personRemoved={(e) => handlePersonRemoved(e.detail)}
        on:personUpdated={(e) => hadlePersonUpdated(e.detail)}
    />

    <InviteModal bind:this={inviteModal} stemma={selectedStemma} {stemmaIndex} on:invite={(e) => handleInvitationCreation(e.detail)} />
    <AboutModal bind:this={aboutModal} />

    <Navbar
        bind:ownedStemmasDescriptions
        bind:selectedStemmaDescription
        bind:lookupPersonName
        bind:disabled={isWaiting}
        on:createNewStemma={() => addStemmaModal.promptNewStemma(false)}
        on:createNewFamily={() => familySelectionModal.promptNewFamily()}
        on:removeStemma={(e) => removeStemmaModal.askForConfirmation(e.detail)}
        on:invite={() => inviteModal.showInvintation()}
        on:about={() => aboutModal.show()}
    />

    {#await waiting}
        <div class="position-absolute top-50 start-50 translate-middle">
            <Circle2 />
            <p class="mt-2">Минуту...</p>
        </div>
    {:catch error}
        <div>
            <div class="alert alert-danger alert-dismissible fade mt-2 mx-2 show">
                <button type="button" class="btn-close" data-bs-dismiss="alert" />
                <div><strong>Упс! </strong>{error.message}</div>
            </div>
        </div>
    {/await}

    {#if !isWaiting}
        <FullStemma
            bind:this={stemmaChart}
            stemma={selectedStemma}
            stemmaId={selectedStemmaDescription.id}
            {stemmaIndex}
            {highlight}
            {pinnedPeople}
            on:personSelected={(e) => handlePersonSelection(e.detail)}
            on:familySelected={(e) => handleFamilySelection(e.detail)}
        />
    {/if}
{:else}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Authenticate
                {google_client_id}
                on:signIn={(e) => {
                    console.log("new sign in signal");
                    handleSignIn(e.detail);
                }}
            />
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
