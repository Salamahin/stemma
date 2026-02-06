import { HiglightLineages } from './highlight';
import { CreateNewPerson, Model, PersonDefinition, Stemma, StemmaDescription, User } from './model';
import { PinnedPeopleStorage } from './pinnedPeopleStorage';
import { StemmaIndex } from './stemmaIndex';
import { writable, get } from 'svelte/store';
import { SettingsStorage } from './settingsStroage';

export class AppController {
    private static readonly LAST_STEMMA_KEY = "stemma_last_stemma_id";
    stemma = writable<Stemma>(null)
    stemmaIndex = writable<StemmaIndex>(null)
    pinnedStorage = writable<PinnedPeopleStorage>(null)
    highlight = writable<HiglightLineages>(null)
    ownedStemmas = writable<Array<StemmaDescription>>([])
    currentStemmaId = writable<string>(null)
    isWorking = writable<boolean>(false)
    invitationToken = writable<string>(null)
    err = writable<Error>(null)
    settingsStorage = writable<SettingsStorage>(null);

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
                const lastStemmaId = this.loadLastStemmaId();
                if (lastStemmaId) {
                    const match = result.stemmas.find((s) => s.id === lastStemmaId);
                    if (match) selectedStemma = match;
                }
                const stemmaPromise = selectedStemma.id === result.stemmas[0].id
                    ? Promise.resolve(result.firstStemma)
                    : this.model.getStemma(selectedStemma.id);

                return stemmaPromise.then((stemma) => {
                    this.refreshIndexes(stemma, selectedStemma.id)
                    this.ownedStemmas.set(result.stemmas)
                    this.setCurrentStemmaId(selectedStemma.id)
                    this.stemma.set(stemma)
                })
            })
            .catch(err => {
                this.err.set(err)
                console.error('Err when listing stemmas after authenticate: ', err.stack);
            })
            .finally(() => this.isWorking.set(false))
    }

    authenticateAndBearToken(user: User, token: string) {
        this.isWorking.set(true)
        this.err.set(null)

        this.model = new Model(this.stemmaBackendUrl, user)
        this.model
            .bearInvitationToken(token)
            .then((result) => {
                let selectedStemma = result.stemmas.slice(-1)[0]
                let stemma = result.lastStemma

                this.refreshIndexes(stemma, selectedStemma.id)
                this.ownedStemmas.set(result.stemmas)
                this.setCurrentStemmaId(selectedStemma.id)
                this.stemma.set(stemma)

                this.isWorking.set(false)
            })
            .catch(err => {
                this.err.set(err)
                console.error('Err when bearing the token: ', err.stack);
            })
            .finally(() => this.isWorking.set(false))
    }

    selectStemma(stemmaId: string) {
        this.isWorking.set(true)
        this.err.set(null)

        this.setCurrentStemmaId(stemmaId)
        this.model
            .getStemma(stemmaId)
            .then((result) => {
                this.refreshIndexes(result, stemmaId)
                this.stemma.set(result)
            })
            .catch(err => {
                this.err.set(err)
                console.error('Err when fetching stemma data: ', err.stack);
            })
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
            .catch(err => {
                this.err.set(err)
                console.error('Err when removing stemma: ', err.stack);
            })
            .finally(() => this.isWorking.set(false))
    }

    cloneStemma(name: string, stemmaId: string) {
        this.isWorking.set(true)
        this.err.set(null)
        this.model
            .cloneStemma(stemmaId, name)
            .then((result) => {
                let clonedStemmaId = result.stemmas.slice(-1)[0].id
                let clonedStemma = result.createdStemma;
                this.refreshIndexes(clonedStemma, clonedStemmaId)

                this.ownedStemmas.set(result.stemmas)
                this.stemma.set(clonedStemma)
                this.setCurrentStemmaId(clonedStemmaId)
            })
            .catch(err => {
                this.err.set(err)
                console.error('Err when cloning stemma: ', err.stack);
            })
            .finally(() => this.isWorking.set(false))
    }

    addStemma(stemmaName: string) {
        this.isWorking.set(true)
        this.err.set(null)
        this.model
            .addStemma(stemmaName)
            .then((result) => {
                let stemma = { people: [], families: [] }
                this.refreshIndexes(stemma, result.id)
                this.ownedStemmas.update(ownedStemmas => [...ownedStemmas, result])
                this.setCurrentStemmaId(result.id)
                this.stemma.set(stemma)
            })
            .catch(err => {
                this.err.set(err)
                console.error('Err when adding a new stemma: ', err.stack);
            })
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

    updatePerson(personId: string, descr: CreateNewPerson, pin: boolean) {
        let si = get(this.stemmaIndex)
        this.refreshVisual(si, personId, pin);

        let originalPerson = si.person(personId);
        if (
            originalPerson.birthDate != descr.birthDate ||
            originalPerson.deathDate != descr.deathDate ||
            originalPerson.name != descr.name ||
            originalPerson.bio != descr.bio
        ) {
            this.manipulateStemma((model, stemmaId) => model.updatePerson(stemmaId, personId, descr, si))
        }
    }

    removePerson(personId: string) {
        this.manipulateStemma((model, stemmaId) => model.removePerson(stemmaId, personId, get(this.stemmaIndex)))
    }

    createInvitationToken(personId: string, email: string) {
        this.invitationToken.set(null)
        this.model
            .createInvintation(get(this.currentStemmaId), personId, email, get(this.stemmaIndex))
            .then(tkn => this.invitationToken.set(tkn))
    }

    private manipulateStemma(action: (m: Model, currentStemmaId: string) => Promise<Stemma>) {
        let currentStemmaId = get(this.currentStemmaId)

        this.isWorking.set(true)
        this.err.set(null)

        action(this.model, currentStemmaId)
            .then((result) => {
                this.refreshIndexes(result, currentStemmaId)
                this.stemma.set(result)
            })
            .catch(err => {
                this.err.set(err)
                console.error('Err when manipulating stemma data: ', err.stack);
            })
            .finally(() => this.isWorking.set(false))
    }


    private refreshVisual(index: StemmaIndex, personId: string, pinned: boolean) {
        this.pinnedStorage.update(u => {
            if (pinned) u.add(personId)
            else u.remove(personId)

            this.highlight.set(new HiglightLineages(index, u.allPinned()))

            return u
        })
    }

    private refreshIndexes(stemma: Stemma, stemmaId: string) {
        let pp = new PinnedPeopleStorage(stemmaId)
        pp.load()

        let ss = new SettingsStorage(stemmaId)
        ss.load()

        let si = new StemmaIndex(stemma)
        let hg = new HiglightLineages(si, pp.allPinned());

        this.pinnedStorage.set(pp)
        this.highlight.set(hg)
        this.stemmaIndex.set(si)
        this.settingsStorage.set(ss)
    }

    private setCurrentStemmaId(stemmaId: string) {
        this.currentStemmaId.set(stemmaId)
        this.persistLastStemmaId(stemmaId)
    }

    private loadLastStemmaId() {
        try {
            return localStorage.getItem(AppController.LAST_STEMMA_KEY)
        } catch {
            return null
        }
    }

    private persistLastStemmaId(stemmaId: string) {
        try {
            if (stemmaId) localStorage.setItem(AppController.LAST_STEMMA_KEY, stemmaId)
        } catch {
            // ignore storage errors
        }
    }
}
