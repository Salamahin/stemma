<script lang="ts">
    import Authenticate from "./components/Authenticate.svelte";
    import Navbar from "./components/Navbar.svelte";
    import AddStemmaModal from "./components/AddStemmaModal.svelte";
    import AddFamilyModal, { CreateFamily } from "./components/AddFamilyModal.svelte";
    import PersonSelectionModal, { UpdatePerson } from "./components/PersonSelectionModal.svelte";
    import FullStemma from "./components/FullStemma.svelte";
    import { Model, StemmaDescription, User, Stemma } from "./model";
    import { StemmaIndex } from "./stemmaIndex";

    export let google_client_id;
    export let stemma_backend_url;

    let addStemmaModal;
    let addFamilyModal;
    let personSelectionModal;

    let model: Model;
    let user: User = {
        name: "john doe",
        id_token: "",
        image_url: "",
    };

    let signedIn = false;

    let ownedStemmasDescriptions: StemmaDescription[] = [];
    let selectedStemmaDescription: StemmaDescription;
    let selectedStemma: Stemma = { people: [], families: [] };
    let stemmaIndex: StemmaIndex;

    function handleSignIn(event: CustomEvent) {
        user = event.detail as User;
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

    $: {
        if (selectedStemmaDescription)
            model.getStemma(selectedStemmaDescription.id).then((s) => {
                selectedStemma = s;
            });
    }

    $: {
        stemmaIndex = new StemmaIndex(selectedStemma);
        console.log("updated!");
        console.log(stemmaIndex.maxGeneration());
    }
</script>

<main>
    <div class="authenticate-bg {!signedIn ? 'd-block' : 'd-none'}">
        <div class="authenticate-holder">
            <Authenticate {google_client_id} on:signIn={handleSignIn} />
        </div>
    </div>

    <div class={signedIn ? "d-block" : "d-none"}>
        <Navbar
            {user}
            bind:ownedStemmasDescriptions
            bind:selectedStemmaDescription
            on:createNewStemma={() => addStemmaModal.promptNewStemma(false)}
            on:createNewFamily={() => addFamilyModal.promptNewFamily()}
        />
    </div>

    <AddStemmaModal bind:this={addStemmaModal} on:stemmaAdded={handleNewStemma} />

    <AddFamilyModal bind:this={addFamilyModal} stemma={selectedStemma} {stemmaIndex} on:familyAdded={(e) => handleNewFamilyCreation(e)} />

    <PersonSelectionModal bind:this={personSelectionModal} on:personRemoved={(e) => handlePersonRemoved(e)} on:personUpdated={(e) => hadlePersonUpdated(e)} />

    <FullStemma stemma={selectedStemma} {stemmaIndex} on:personSelected={(e) => personSelectionModal.showPersonDetails(e.detail)} />

    <script src="vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
</main>

<style>
    main {
        height: 100%;
    }

    .authenticate-bg {
        background-image: url("/assets/bg.webp");
        height: 100%;
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
