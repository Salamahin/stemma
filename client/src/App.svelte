<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import AddStemmaModal from "./components/add_stemma_modal/AddStemmaModal.svelte";
    import FamilySelectionModal, { GetOrCreateFamily } from "./components/family_modal/FamilyDetailsModal.svelte";
    import PersonSelectionModal, { UpdatePerson } from "./components/person_details_modal/PersonDetailsModal.svelte";
    import FullStemma from "./components/FullStemma.svelte";
    import { Model, StemmaDescription, User, Stemma, StoredPerson, Family } from "./model";
    import { StemmaIndex } from "./stemmaIndex";
    import { HiglightLineages } from "./highlight";
    import { PinnedPeopleStorage } from "./pinnedPeopleStorage";
    import fuzzysort from "fuzzysort";
    import RemoveStemmaModal from "./components/delete_stemma_modal/RemoveStemmaModal.svelte";
    import InviteModal, { CreateInviteLink } from "./components/invite_modal/InviteModal.svelte";
    import { onMount } from "svelte";

    export let google_client_id;
    export let stemma_backend_url;

    let addStemmaModal;
    let familySelectionModal;
    let personSelectionModal;
    let stemmaChart;
    let removeStemmaModal;
    let inviteModal;

    let model: Model;
    let signedIn = false;

    let ownedStemmasDescriptions: StemmaDescription[];
    let selectedStemmaDescription: StemmaDescription;
    let selectedStemma: Stemma;
    let stemmaIndex: StemmaIndex;
    let lookupPersonName;

    let highlight: HiglightLineages;
    let pinnedPeople: PinnedPeopleStorage;

    function handleSignIn(user: User) {
        signedIn = true;
        model = new Model(stemma_backend_url, user);

        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.has("inviteToken")) {
            console.log("invite");
            model
                .proposeInvitationToken(urlParams.get("inviteToken"))
                .catch((e) => {})
                .then(() => model.listStemmas().then((stemmas) => (ownedStemmasDescriptions = stemmas.stemmas)));
        } else {
            model.listStemmas().then((stemmas) => (ownedStemmasDescriptions = stemmas.stemmas));
        }
    }

    function handleNewStemma(name: string) {
        model.addStemma(name).then((newStemmaDescription) => {
            ownedStemmasDescriptions = [...ownedStemmasDescriptions, newStemmaDescription];
            selectedStemmaDescription = newStemmaDescription;
        });
    }

    function handleNewFamilyCreation(request: GetOrCreateFamily) {
        model.createFamily(selectedStemmaDescription.id, request.parents, request.children).then((s) => (selectedStemma = s));
    }

    function hadlePersonUpdated(request: UpdatePerson) {
        pinnedPeople = request.pin ? pinnedPeople.add(request.id) : pinnedPeople.remove(request.id);

        let originalPerson = stemmaIndex.person(request.id);

        if (
            originalPerson.birthDate != request.description.birthDate ||
            originalPerson.deathDate != request.description.deathDate ||
            originalPerson.name != request.description.name ||
            originalPerson.bio != request.description.bio
        )
            model.updatePerson(selectedStemmaDescription.id, request.id, request.description).then((s) => (selectedStemma = s));
    }

    function handleFamilyUpdated(request: GetOrCreateFamily) {
        model.updateFamily(selectedStemmaDescription.id, request.familyId, request.parents, request.children).then((s) => (selectedStemma = s));
    }

    function handleFamilyRemoved(familyId: string) {
        model.removeFamily(selectedStemmaDescription.id, familyId).then((s) => (selectedStemma = s));
    }

    function handlePersonRemoved(personId: string) {
        model.removePerson(selectedStemmaDescription.id, personId).then((s) => (selectedStemma = s));
        pinnedPeople = pinnedPeople.remove(personId);
    }

    function handlePersonSelection(personDetails: StoredPerson) {
        personSelectionModal.showPersonDetails({ description: personDetails, pin: pinnedPeople.isPinned(personDetails.id) });
    }

    function handleFamilySelection(familyDetails: Family) {
        familySelectionModal.showExistingFamily(familyDetails);
    }

    function handleStemmaRemoval(stemmaId) {
        model.removeStemma(stemmaId).then((st) => (ownedStemmasDescriptions = st.stemmas));
    }

    function handleInvitationCreation(e: CreateInviteLink) {
        model.createInvintation(selectedStemmaDescription.id, e.personId, e.email).then((link) => inviteModal.setInviteLink(link));
    }

    function updateEverythingOnStemmaChange(stemmaId: string, stemma: Stemma) {
        let si = new StemmaIndex(stemma);

        let pp = new PinnedPeopleStorage(stemmaId);
        pp.load();

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

    $: if (selectedStemmaDescription)
        model.getStemma(selectedStemmaDescription.id).then((s) => {
            let { si, pp, hg } = updateEverythingOnStemmaChange(selectedStemmaDescription.id, s);

            selectedStemma = s;
            stemmaIndex = si;
            pinnedPeople = pp;
            highlight = hg;
        });

    $: if (ownedStemmasDescriptions && ownedStemmasDescriptions.length == 0) addStemmaModal.promptNewStemma(true);

    $: if (selectedStemma) {
        let { si, hg } = updateIndexAndHighlightOnStemmaChange(selectedStemma);
        stemmaIndex = si;
        highlight = hg;
    }

    $: if (pinnedPeople) highlight = updateHighlightOnPinnedPeopleChange(pinnedPeople);

    $: if (lookupPersonName) {
        let results = fuzzysort.go(lookupPersonName, selectedStemma.people, { key: "name" });
        if (results.length) stemmaChart.zoomToNode(results[0].obj.id);
    }
</script>

{#if signedIn}
    <Navbar
        bind:ownedStemmasDescriptions
        bind:selectedStemmaDescription
        bind:lookupPersonName
        on:createNewStemma={() => addStemmaModal.promptNewStemma(false)}
        on:createNewFamily={() => familySelectionModal.promptNewFamily()}
        on:removeStemma={(e) => removeStemmaModal.askForConfirmation(e.detail)}
        on:invite={() => inviteModal.showInvintation()}
    />

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

    <FullStemma
        bind:this={stemmaChart}
        stemma={selectedStemma}
        {stemmaIndex}
        {highlight}
        {pinnedPeople}
        on:personSelected={(e) => handlePersonSelection(e.detail)}
        on:familySelected={(e) => handleFamilySelection(e.detail)}
    />

    <InviteModal bind:this={inviteModal} stemma={selectedStemma} {stemmaIndex} on:invite={(e) => handleInvitationCreation(e.detail)} />
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
