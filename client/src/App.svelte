<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import AddStemmaModal from "./components/AddStemmaModal.svelte";
    import AddFamilyModal, { CreateFamily } from "./components/AddFamilyModal.svelte";
    import PersonSelectionModal, { UpdatePerson } from "./components/PersonDetailsModal.svelte";
    import FullStemma from "./components/FullStemma.svelte";
    import { Model, StemmaDescription, User, Stemma, StoredPerson } from "./model";
    import { StemmaIndex } from "./stemmaIndex";
    import { ComposableSelectionController, SelectionController } from "./selectionController";

    export let google_client_id;
    export let stemma_backend_url;

    let addStemmaModal;
    let addFamilyModal;
    let personSelectionModal;

    let model: Model;
    let signedIn = false;

    let ownedStemmasDescriptions: StemmaDescription[] = [];
    let selectedStemmaDescription: StemmaDescription;
    let selectedStemma: Stemma = { people: [], families: [] };
    let stemmaIndex: StemmaIndex;
    let selectionController: SelectionController = new ComposableSelectionController();

    function handleSignIn(event: CustomEvent) {
        let user = event.detail as User;
        signedIn = true;
        model = new Model(stemma_backend_url, user);
        model.listStemmas().then((stemmas) => {
            ownedStemmasDescriptions = stemmas.stemmas;
            if (ownedStemmasDescriptions.length == 0) addStemmaModal.promptNewStemma(true);
        });
    }

    function handleNewStemma(event: CustomEvent<string>) {
        let name = event.detail;
        model.addStemma(name).then((newStemmaDescription) => {
            ownedStemmasDescriptions = [...ownedStemmasDescriptions, newStemmaDescription];
            selectedStemmaDescription = newStemmaDescription;
        });
    }

    function handleNewFamilyCreation(event: CustomEvent<CreateFamily>) {
        model.createFamily(selectedStemmaDescription.id, event.detail.parents, event.detail.children).then((s) => (selectedStemma = s));
    }

    function hadlePersonUpdated(event: CustomEvent<UpdatePerson>) {
        model.updatePerson(selectedStemmaDescription.id, event.detail.id, event.detail.description).then((s) => (selectedStemma = s));
    }

    function handlePersonRemoved(event: CustomEvent<string>) {
        model.removePerson(selectedStemmaDescription.id, event.detail).then((s) => (selectedStemma = s));
    }

    function handlePersonSelection(event: CustomEvent<StoredPerson>) {
        if (addFamilyModal.awaitsPersonSelection()) addFamilyModal.personSelected(event.detail);
        else personSelectionModal.showPersonDetails(event.detail);
    }

    $: {
        if (selectedStemmaDescription)
            model.getStemma(selectedStemmaDescription.id).then((s) => {
                selectedStemma = s;
            });
    }

    $: stemmaIndex = new StemmaIndex(selectedStemma);
</script>

{#if signedIn}
    <Navbar
        bind:ownedStemmasDescriptions
        bind:selectedStemmaDescription
        on:createNewStemma={() => addStemmaModal.promptNewStemma(false)}
        on:createNewFamily={() => addFamilyModal.promptNewFamily()}
        stemma={selectedStemma}
    />

    <AddStemmaModal bind:this={addStemmaModal} on:stemmaAdded={handleNewStemma} />

    <AddFamilyModal
        bind:this={addFamilyModal}
        stemma={selectedStemma}
        {stemmaIndex}
        on:familyAdded={(e) => handleNewFamilyCreation(e)}
    />

    <PersonSelectionModal bind:this={personSelectionModal} on:personRemoved={(e) => handlePersonRemoved(e)} on:personUpdated={(e) => hadlePersonUpdated(e)} />

    <FullStemma stemma={selectedStemma} {stemmaIndex} bind:selectionController on:personSelected={(e) => handlePersonSelection(e)} />
{:else}
    <div class="authenticate-bg vh-100">
        <div class="authenticate-holder">
            <Authenticate {google_client_id} on:signIn={handleSignIn} />
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
