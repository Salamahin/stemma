import { HighlightLineages } from './highlight';
import { Model } from './model';
import type { CreateNewPerson, LinkRole, PersonDefinition, Stemma, StemmaDescription } from './model';
import { PinnedPeopleStorage } from './pinnedPeopleStorage';
import { StemmaIndex } from './stemmaIndex';
import { writable, get } from 'svelte/store';
import { SettingsStorage } from './settingsStorage';
import { selectStemmaId } from './appControllerSelection';

export type MutationOptions = { silent?: boolean }
export type MutationResult = { newPersonIds: string[]; newFamilyIds: string[] }

export class AppController {
    private static readonly LAST_STEMMA_KEY = "stemma_last_stemma_id";
    stemma = writable<Stemma>(null)
    stemmaIndex = writable<StemmaIndex>(null)
    pinnedStorage = writable<PinnedPeopleStorage>(null)
    highlight = writable<HighlightLineages>(null)
    ownedStemmas = writable<Array<StemmaDescription>>([])
    currentStemmaId = writable<string>(null)
    isWorking = writable<boolean>(false)
    invitationToken = writable<string>(null)
    err = writable<Error>(null)
    settingsStorage = writable<SettingsStorage>(null);

    readonly model: Model

    constructor(stemmaBackendUrl: string, model?: Model) {
        this.model = model ?? new Model(stemmaBackendUrl);
    }

    async listStemmas(): Promise<void> {
        this.isWorking.set(true)
        this.err.set(null)
        try {
            const result = await this.model.listDescribeStemmas()
            if (result.stemmas.length === 0) {
                this.ownedStemmas.set(result.stemmas)
                return
            }
            const selectedId = selectStemmaId(
                result.stemmas,
                this.loadLastStemmaId(),
                result.defaultStemmaId,
            );
            const selectedStemma = result.stemmas.find((s) => s.id === selectedId)!;
            const stemma = selectedStemma.id === result.stemmas[0].id
                ? result.firstStemma
                : await this.model.getStemma(selectedStemma.id);
            this.refreshIndexes(stemma, selectedStemma.id)
            this.ownedStemmas.set(result.stemmas)
            this.setCurrentStemmaId(selectedStemma.id)
            this.stemma.set(stemma)
        } finally {
            this.isWorking.set(false)
        }
    }

    bearInvitationToken(token: string) {
        this.isWorking.set(true)
        this.err.set(null)

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
        const sameStemma = get(this.currentStemmaId) === stemmaId
        if (!sameStemma) this.isWorking.set(true)
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
            .finally(() => { if (!sameStemma) this.isWorking.set(false) })
    }

    removeStemma(stemmaId: string) {
        this.isWorking.set(true)
        this.err.set(null)
        const wasCurrent = get(this.currentStemmaId) === stemmaId
        this.model
            .removeStemma(stemmaId)
            .then((result) => {
                this.ownedStemmas.set(result.stemmas)
                if (!wasCurrent) return
                if (result.stemmas.length === 0) {
                    this.stemma.set(null)
                    this.stemmaIndex.set(null)
                    this.pinnedStorage.set(null)
                    this.highlight.set(null)
                    this.settingsStorage.set(null)
                    this.setCurrentStemmaId(null)
                    return
                }
                const nextId = selectStemmaId(result.stemmas, this.loadLastStemmaId(), null)
                return this.model.getStemma(nextId).then((next) => {
                    this.refreshIndexes(next, nextId)
                    this.setCurrentStemmaId(nextId)
                    this.stemma.set(next)
                })
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

    renameStemma(stemmaId: string, newName: string) {
        this.isWorking.set(true)
        this.err.set(null)
        this.model
            .renameStemma(stemmaId, newName)
            .then((updated) => {
                this.ownedStemmas.update((stemmas) =>
                    stemmas.map((s) => (s.id === updated.id ? updated : s))
                )
            })
            .catch(err => {
                this.err.set(err)
                console.error('Err when renaming stemma: ', err.stack);
            })
            .finally(() => this.isWorking.set(false))
    }

    addStemma(stemmaName: string) {
        this.isWorking.set(true)
        this.err.set(null)
        this.model
            .addStemma(stemmaName)
            .then((result) => {
                let stemma: Stemma = { type: "Stemma", people: [], families: [] }
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

    createOrphanPerson(descr: CreateNewPerson, options?: MutationOptions) {
        return this.manipulateStemma((model, stemmaId) => model.createOrphanPerson(stemmaId, descr), options)
    }

    linkPersons(fromPersonId: string, toPersonId: string, role: LinkRole, options?: MutationOptions) {
        return this.manipulateStemma(
            (model, stemmaId) => model.linkPersons(stemmaId, fromPersonId, toPersonId, role, get(this.stemmaIndex)),
            options,
        )
    }

    createFamily(parents: PersonDefinition[], children: PersonDefinition[], options?: MutationOptions) {
        return this.manipulateStemma((model, stemmaId) => model.createFamily(stemmaId, parents, children, get(this.stemmaIndex)), options)
    }

    updateFamily(familyId: string, parents: PersonDefinition[], children: PersonDefinition[], options?: MutationOptions) {
        return this.manipulateStemma((model, stemmaId) => model.updateFamily(stemmaId, familyId, parents, children, get(this.stemmaIndex)), options)
    }

    removeFamily(familyId: string, options?: MutationOptions) {
        return this.manipulateStemma((model, stemmaId) => model.removeFamily(stemmaId, familyId), options)
    }

    savePerson(personId: string, descr: CreateNewPerson, pin: boolean, photoUpload: Blob | null, photoRemove: boolean) {
        const stemmaId = get(this.currentStemmaId)
        const si = get(this.stemmaIndex)
        this.refreshVisual(si, personId, pin);

        const original = si.person(personId);
        const fieldsChanged =
            original.birthDate != descr.birthDate ||
            original.deathDate != descr.deathDate ||
            original.name != descr.name ||
            original.bio != descr.bio;

        if (!photoUpload && !photoRemove && !fieldsChanged) return;

        this.isWorking.set(true)
        this.err.set(null)

        const photoStep: Promise<void> = photoUpload
            ? this.model
                  .requestPhotoUploadUrl(stemmaId, personId, photoUpload.type)
                  .then((urlInfo) =>
                      this.model.uploadPhotoToPresignedUrl(urlInfo.uploadUrl, urlInfo.uploadFields, photoUpload).then(() => urlInfo.photoKey),
                  )
                  .then((photoKey) => this.model.setPersonPhoto(stemmaId, personId, photoKey, get(this.stemmaIndex)))
                  .then((result) => {
                      this.refreshIndexes(result, stemmaId)
                      this.stemma.set(result)
                  })
            : photoRemove
              ? this.model.setPersonPhoto(stemmaId, personId, null, get(this.stemmaIndex)).then((result) => {
                    this.refreshIndexes(result, stemmaId)
                    this.stemma.set(result)
                })
              : Promise.resolve()

        photoStep
            .then(() => {
                if (!fieldsChanged) return
                return this.model.updatePerson(stemmaId, personId, descr, get(this.stemmaIndex)).then((result) => {
                    this.refreshIndexes(result, stemmaId)
                    this.stemma.set(result)
                })
            })
            .catch((err) => {
                this.err.set(err)
                console.error('Err when saving person: ', err.stack)
            })
            .finally(() => this.isWorking.set(false))
    }

    removePerson(personId: string, options?: MutationOptions) {
        return this.manipulateStemma((model, stemmaId) => model.removePerson(stemmaId, personId, get(this.stemmaIndex)), options)
    }

    createInvitationToken(personId: string, email: string) {
        this.invitationToken.set(null)
        this.model
            .createInvintation(get(this.currentStemmaId), personId, email, get(this.stemmaIndex))
            .then(tkn => this.invitationToken.set(tkn))
    }

    private manipulateStemma(
        action: (m: Model, currentStemmaId: string) => Promise<Stemma>,
        options?: MutationOptions,
    ): Promise<MutationResult> {
        let currentStemmaId = get(this.currentStemmaId)
        const silent = options?.silent ?? false

        const prevStemma = get(this.stemma)
        const prevPersonIds = new Set((prevStemma?.people ?? []).map((p) => p.id))
        const prevFamilyIds = new Set((prevStemma?.families ?? []).map((f) => f.id))

        if (!silent) this.isWorking.set(true)
        this.err.set(null)

        return action(this.model, currentStemmaId)
            .then((result) => {
                this.refreshIndexes(result, currentStemmaId)
                this.stemma.set(result)
                return {
                    newPersonIds: result.people.filter((p) => !prevPersonIds.has(p.id)).map((p) => p.id),
                    newFamilyIds: result.families.filter((f) => !prevFamilyIds.has(f.id)).map((f) => f.id),
                }
            })
            .catch(err => {
                this.err.set(err)
                console.error('Err when manipulating stemma data: ', err.stack);
                throw err
            })
            .finally(() => { if (!silent) this.isWorking.set(false) })
    }


    private refreshVisual(index: StemmaIndex, personId: string, pinned: boolean) {
        this.pinnedStorage.update(u => {
            if (pinned) u.add(personId)
            else u.remove(personId)

            this.highlight.set(new HighlightLineages(index, u.allPinned()))

            return u
        })
    }

    private refreshIndexes(stemma: Stemma, stemmaId: string) {
        let pp = new PinnedPeopleStorage(stemmaId)
        pp.load()

        let ss = new SettingsStorage(stemmaId)
        ss.load()

        let si = new StemmaIndex(stemma)
        let hg = new HighlightLineages(si, pp.allPinned());

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
