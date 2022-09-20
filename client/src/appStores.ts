import { Highlight, HiglightLineages } from './highlight';
import { CreateNewPerson, Model, OwnedStemmas, PersonDefinition, Stemma, StemmaDescription, User } from './model';
import { PinnedPeopleStorage } from './pinnedPeopleStorage';
import { StemmaIndex } from './stemmaIndex';
import { writable, get } from 'svelte/store'

export class Stores {
    stemma = writable(null)
    stemmaIndex = writable(null)
    pinnedStorage = writable(null)
    highlight = writable(null)
    ownedStemmas = writable([])
    currentStemma = writable(null)
    isWorking = writable(false)
    invitationToken = writable(null)
    err = writable(null)

    private model: Model
    private stemmaBackendUrl: string

    constructor(stemmaBackendUrl: string) {
        this.stemmaBackendUrl = stemmaBackendUrl;
    }

    authenticateAndListStemmas(user: User) {
        this.isWorking.set(true)
        this.err.set(null)

        this.model = new Model(this.stemmaBackendUrl, user)
        this.model
            .listDescribeStemmas()
            .then((result) => {
                let selectedStemma = result.stemmas[0]
                let stemma = result.firstStemma

                this.refreshIndexes(stemma, selectedStemma.id)
                this.ownedStemmas.set(result.stemmas)
                this.currentStemma.set(selectedStemma.id)
                this.stemma.set(stemma)
            })
            .catch(err => this.err.set(err))
            .finally(() => this.isWorking.set(false))
    }

    authenticateAndBearToken(user: User, token: string) {
        this.isWorking.set(true)
        this.err.set(null)

        this.model = new Model(this.stemmaBackendUrl, user)
        this.model
            .bearInvitationToken(token)
            .then((result) => {
                let selectedStemma = result.stemmas[-1]
                let stemma = result.lastStema

                this.refreshIndexes(stemma, selectedStemma.id)
                this.ownedStemmas.set(result.stemmas)
                this.currentStemma.set(selectedStemma.id)
                this.stemma.set(stemma)

                this.isWorking.set(false)
            })
            .catch(err => this.err.set(err))
            .finally(() => this.isWorking.set(false))
    }

    selectStemma(ownedStemma: StemmaDescription) {
        this.isWorking.set(true)
        this.err.set(null)

        this.currentStemma.set(ownedStemma)
        this.model
            .getStemma(ownedStemma.id)
            .then((result) => {
                this.refreshIndexes(result, ownedStemma.id)
                this.stemma.set(result)
            })
            .catch(err => this.err.set(err))
            .finally(() => this.isWorking.set(false))
    }

    removeStemma(stemmaId: string) {
        this.isWorking.set(true)
        this.err.set(null)
        this.model
            .removeStemma(stemmaId)
            .then((result) => {
                this.ownedStemmas.set(result.stemmas)
            })
            .catch(err => this.err.set(err))
            .finally(() => this.isWorking.set(false))
    }

    addStemma(stemmaName: string) {
        this.isWorking.set(true)
        this.err.set(null)
        this.model
            .addStemma(stemmaName)
            .then((result) => {
                this.ownedStemmas.update(ownedStemmas => [...ownedStemmas, result])
                this.currentStemma.set(result)
                this.refreshIndexes({ people: [], families: [] }, result.id)
            })
            .catch(err => this.err.set(err))
            .finally(() => this.isWorking.set(false))
    }

    createFamily(parents: PersonDefinition[], children: PersonDefinition[]) {
        this.manipulateStemma((model, stemmaId) => model.createFamily(stemmaId, parents, children, get(this.stemmaIndex)))
    }

    updateFamily(familyId: string, parents: PersonDefinition[], children: PersonDefinition[]) {
        this.manipulateStemma((model, stemmaId) => model.updateFamily(stemmaId, familyId, parents, children, get(this.stemmaIndex)))
    }

    removeFamily(familyId: string) {
        this.manipulateStemma((model, stemmaId) => model.removeFamily(stemmaId, familyId))
    }

    updatePerson(personId: string, descr: CreateNewPerson) {
        this.manipulateStemma((model, stemmaId) => model.updatePerson(stemmaId, personId, descr, get(this.stemmaIndex)))
    }

    removePerson(personId: string) {
        this.manipulateStemma((model, stemmaId) => model.removePerson(stemmaId, personId, get(this.stemmaIndex)))
    }

    createInvitationToken(personId: string, email: string): Promise<string> {
        return this.model
            .createInvintation(get(this.currentStemma).id, personId, email, get(this.stemmaIndex))
    }

    private manipulateStemma(action: (m: Model, currentStemmaId: string) => Promise<Stemma>) {
        let currentStemmaId = get(this.currentStemma).id

        this.isWorking.set(true)
        this.err.set(null)

        action(this.model, currentStemmaId)
            .then((result) => {
                this.refreshIndexes(result, currentStemmaId)
                this.stemma.set(result)
            })
            .catch(err => this.err.set(err))
            .finally(() => this.isWorking.set(false))
    }


    private refreshIndexes(stemma: Stemma, stemmaId: string) {
        let pp = new PinnedPeopleStorage(stemmaId)
        pp.load()
        let si = new StemmaIndex(stemma)
        let hg = new HiglightLineages(si, pp.allPinned());

        this.pinnedStorage.set(pp)
        this.highlight.set(hg)
        this.stemmaIndex.set(si)
    }
}