<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import AddStemmaModal from "./components/add_stemma_modal/AddStemmaModal.svelte";
    import AddFamilyModal, { CreateFamily } from "./components/family_modal/AddFamilyModal.svelte";
    import PersonSelectionModal, { UpdatePerson } from "./components/person_details_modal/PersonDetailsModal.svelte";
    import FullStemma from "./components/FullStemma.svelte";
    import { Model, StemmaDescription, User, Stemma, StoredPerson } from "./model";
    import { StemmaIndex } from "./stemmaIndex";
    import { HiglightLineages, HighlightAll } from "./highlight";
    import { PinnedPeopleStorage } from "./pinnedPeopleStorage";
    import fuzzysort from "fuzzysort";

    export let google_client_id;
    export let stemma_backend_url;

    let addStemmaModal;
    let addFamilyModal;
    let personSelectionModal;

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
        model.listStemmas().then((stemmas) => {
            ownedStemmasDescriptions = stemmas.stemmas;
            if (ownedStemmasDescriptions.length == 0) addStemmaModal.promptNewStemma(true);
        });
    }

    function handleNewStemma(name: string) {
        model.addStemma(name).then((newStemmaDescription) => {
            ownedStemmasDescriptions = [...ownedStemmasDescriptions, newStemmaDescription];
            selectedStemmaDescription = newStemmaDescription;
        });
    }

    function handleNewFamilyCreation(request: CreateFamily) {
        model.createFamily(selectedStemmaDescription.id, request.parents, request.children).then((s) => (selectedStemma = s));
    }

    function hadlePersonUpdated(request: UpdatePerson) {
        pinnedPeople = request.pin ? pinnedPeople.add(request.id) : pinnedPeople.remove(request.id);

        let originalPerson = stemmaIndex.get(request.id);

        if (
            originalPerson.birthDate != request.description.birthDate ||
            originalPerson.deathDate != request.description.deathDate ||
            originalPerson.name != request.description.name ||
            originalPerson.bio != request.description.bio
        )
            model.updatePerson(selectedStemmaDescription.id, request.id, request.description).then((s) => (selectedStemma = s));
    }

    function handlePersonRemoved(personId: string) {
        model.removePerson(selectedStemmaDescription.id, personId).then((s) => (selectedStemma = s));
    }

    function handlePersonSelection(personDetails: StoredPerson) {
        personSelectionModal.showPersonDetails({ description: personDetails, pin: pinnedPeople.isPinned(personDetails.id) });
    }

    $: if (selectedStemmaDescription) {
        pinnedPeople = new PinnedPeopleStorage(selectedStemmaDescription.id);
        pinnedPeople.load();

        model.getStemma(selectedStemmaDescription.id).then((s) => (selectedStemma = s));
    }

    $: if (selectedStemma) stemmaIndex = new StemmaIndex(selectedStemma);
    $: if (pinnedPeople && stemmaIndex) highlight = new HiglightLineages(stemmaIndex, pinnedPeople.allPinned());
    $: {
        if (lookupPersonName && selectedStemma) {
            const results = fuzzysort.go(lookupPersonName, selectedStemma.people, { key: "name" });
            console.log(results)
        }
    }
</script>

{#if signedIn}
    <Navbar
        bind:ownedStemmasDescriptions
        bind:selectedStemmaDescription
        bind:lookupPersonName
        on:createNewStemma={() => addStemmaModal.promptNewStemma(false)}
        on:createNewFamily={() => addFamilyModal.promptNewFamily()}
    />

    <AddStemmaModal bind:this={addStemmaModal} on:stemmaAdded={(e) => handleNewStemma(e.detail)} />

    <AddFamilyModal bind:this={addFamilyModal} stemma={selectedStemma} {stemmaIndex} on:familyAdded={(e) => handleNewFamilyCreation(e.detail)} />

    <PersonSelectionModal
        bind:this={personSelectionModal}
        on:personRemoved={(e) => handlePersonRemoved(e.detail)}
        on:personUpdated={(e) => hadlePersonUpdated(e.detail)}
    />

    <FullStemma stemma={selectedStemma} {stemmaIndex} bind:highlight bind:pinnedPeople on:personSelected={(e) => handlePersonSelection(e.detail)} />
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
