import { StemmaIndex } from "./stemmaIndex"
import { get } from "svelte/store";
import { LocalizedError, t } from "./i18n";
import { sanitizeRequestPayload } from "./requestSanitizer";
import { mapStemmaError } from "./stemmaErrorMapping";
import { buildInviteLink } from "./inviteLinkBuilder";

export enum ViewMode {
    ALL,
    EDITABLE_ONLY,
}

export type Settings = {
    viewMode: ViewMode;
};

export const DEFAULT_SETTINGS: Settings = {
    viewMode: ViewMode.ALL,
};


//requests
export type ExistingPerson = { type: "ExistingPerson", id: string }
export type CreateNewPerson = { type: "CreateNewPerson", name: string, birthDate?: string, deathDate?: string, bio?: string }
export type PersonDefinition = ExistingPerson | CreateNewPerson

export type CreateFamily = { parent1?: PersonDefinition, parent2?: PersonDefinition, children: Array<PersonDefinition> }

export type CreateFamilyRequest = { type: "CreateFamilyRequest", stemmaId: string, familyDescr: CreateFamily }
export type CreateInvitationTokenRequest = { type: "CreateInvitationTokenRequest", stemmaId: string, targetPersonId: string, targetPersonEmail: string }
export type CreateNewStemmaRequest = { type: "CreateNewStemmaRequest", stemmaName: string }
export type DeleteFamilyRequest = { type: "DeleteFamilyRequest", stemmaId: string, familyId: string }
export type DeletePersonRequest = { type: "DeletePersonRequest", stemmaId: string, personId: string }
export type GetStemmaRequest = { type: "GetStemmaRequest", stemmaId: string }
export type DeleteStemmaRequest = { type: "DeleteStemmaRequest", stemmaId: string }
export type UpdatePersonRequest = { type: "UpdatePersonRequest", stemmaId: string, personId: string, personDescr: CreateNewPerson }
export type UpdateFamilyRequest = { type: "UpdateFamilyRequest", stemmaId: string, familyId: string, familyDescr: CreateFamily }
export type BearInvitationRequest = { type: "BearInvitationRequest", encodedToken: string }
export type CloneStemmaRequest = { type: "CloneStemmaRequest", stemmaId: string, stemmaName: string }
export type ListDescribeStemmasRequest = { type: "ListDescribeStemmasRequest", defaultStemmaName: string }
export type RenameStemmaRequest = { type: "RenameStemmaRequest", stemmaId: string, newName: string }

type Request =
    | CreateFamilyRequest
    | UpdateFamilyRequest
    | DeleteFamilyRequest
    | CreateInvitationTokenRequest
    | BearInvitationRequest
    | CreateNewStemmaRequest
    | GetStemmaRequest
    | DeleteStemmaRequest
    | ListDescribeStemmasRequest
    | DeletePersonRequest
    | UpdatePersonRequest
    | CloneStemmaRequest
    | RenameStemmaRequest


//responses
export type FamilyDescription = { type: "FamilyDescription", id: string, parents: Array<string>, children: Array<string>, readOnly: boolean }
export type InviteToken = { type: "InviteToken", token: string }
export type OwnedStemmas = { type: "OwnedStemmas", stemmas: Array<StemmaDescription>, firstStemma: Stemma }
export type Stemma = { type: "Stemma", people: Array<PersonDescription>, families: Array<FamilyDescription> }
export type StemmaDescription = { type: "StemmaDescription", id: string, name: string, removable: Boolean }
export type PersonDescription = { type: "PersonDescription", id: string, name: string, birthDate?: string, deathDate?: string, bio?: string, readOnly: boolean }
export type TokenAccepted = { type: "TokenAccepted", stemmas: Array<StemmaDescription>, lastStemma: Stemma }
export type CloneResult = { type: "CloneResult", createdStemma: Stemma, stemmas: Array<StemmaDescription> }

//errors
export type UnknownError = { type: "UnknownError", cause: string }
export type RequestDeserializationProblem = { type: "RequestDeserializationProblem", descr: string }
export type NoSuchPersonId = { type: "NoSuchPersonId", id: string }
export type ChildAlreadyBelongsToFamily = { type: "ChildAlreadyBelongsToFamily", familyId: string, personId: string }
export type IncompleteFamily = { type: "IncompleteFamily" }
export type DuplicatedIds = { type: "DuplicatedIds", duplicatedIds: string }
export type AccessToFamilyDenied = { type: "AccessToFamilyDenied", familyId: string }
export type AccessToPersonDenied = { type: "AccessToPersonDenied", personId: string }
export type AccessToStemmaDenied = { type: "AccessToStemmaDenied", stemmaId: string }
export type IsNotTheOnlyStemmaOwner = { type: "IsNotTheOnlyStemmaOwner", stemmaId: string }
export type InvalidInviteToken = { type: "InvalidInviteToken" }
export type ForeignInviteToken = { type: "ForeignInviteToken" }
export type StemmaHasCycles = { type: "StemmaHasCycles" }

export type StemmaResponse =
    | FamilyDescription
    | InviteToken
    | OwnedStemmas
    | Stemma
    | StemmaDescription
    | PersonDescription
    | TokenAccepted
    | CloneResult
    | UnknownError
    | RequestDeserializationProblem
    | NoSuchPersonId
    | ChildAlreadyBelongsToFamily
    | IncompleteFamily
    | DuplicatedIds
    | AccessToFamilyDenied
    | AccessToPersonDenied
    | AccessToStemmaDenied
    | IsNotTheOnlyStemmaOwner
    | InvalidInviteToken
    | ForeignInviteToken
    | StemmaHasCycles

//aux
export type User = { id_token: string }

export class Model {
    endpoint: string;
    commonHeader;

    constructor(endpoint: string, user: User) {
        this.endpoint = endpoint
        this.commonHeader = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Authorization': `Bearer ${user.id_token}`
        }
    }

    async listDescribeStemmas(): Promise<OwnedStemmas> {
        return this.send<OwnedStemmas>(
            { type: "ListDescribeStemmasRequest", defaultStemmaName: this.translate("stemma.defaultName") },
            null,
        )
    }

    async removeStemma(stemmaId: string): Promise<OwnedStemmas> {
        return this.send<OwnedStemmas>({ type: "DeleteStemmaRequest", stemmaId }, null)
    }

    async getStemma(stemmaId: string): Promise<Stemma> {
        return this.send<Stemma>({ type: "GetStemmaRequest", stemmaId }, null)
    }

    private makeFamily(parents: PersonDefinition[], children: PersonDefinition[]): CreateFamily {
        return {
            parent1: parents.length > 0 ? sanitizeRequestPayload(parents[0]) as PersonDefinition : null,
            parent2: parents.length > 1 ? sanitizeRequestPayload(parents[1]) as PersonDefinition : null,
            children: children.map(c => sanitizeRequestPayload(c) as PersonDefinition),
        }
    }

    async createFamily(stemmaId: string, parents: PersonDefinition[], children: PersonDefinition[], stemmaIndex: StemmaIndex): Promise<Stemma> {
        return this.send<Stemma>(
            { type: "CreateFamilyRequest", stemmaId, familyDescr: this.makeFamily(parents, children) },
            stemmaIndex,
        )
    }

    async updateFamily(stemmaId: string, familyId: string, parents: PersonDefinition[], children: PersonDefinition[], stemmaIndex: StemmaIndex): Promise<Stemma> {
        return this.send<Stemma>(
            { type: "UpdateFamilyRequest", stemmaId, familyId, familyDescr: this.makeFamily(parents, children) },
            stemmaIndex,
        )
    }

    async addStemma(name: string): Promise<StemmaDescription> {
        return this.send<StemmaDescription>({ type: "CreateNewStemmaRequest", stemmaName: name }, null)
    }

    async removePerson(stemmaId: string, personId: string, stemmaIndex: StemmaIndex): Promise<Stemma> {
        return this.send<Stemma>({ type: "DeletePersonRequest", stemmaId, personId }, stemmaIndex)
    }

    async createInvintation(stemmaId: string, personId: string, email: string, stemmaIndex: StemmaIndex): Promise<string> {
        const token = await this.send<InviteToken>(
            { type: "CreateInvitationTokenRequest", stemmaId, targetPersonId: personId, targetPersonEmail: email },
            stemmaIndex,
        )
        return buildInviteLink(location.origin, token.token)
    }

    async bearInvitationToken(token: string): Promise<TokenAccepted> {
        return this.send<TokenAccepted>({ type: "BearInvitationRequest", encodedToken: token }, null)
    }

    async removeFamily(stemmaId: string, familyId: string): Promise<Stemma> {
        return this.send<Stemma>({ type: "DeleteFamilyRequest", stemmaId, familyId }, null)
    }

    async updatePerson(stemmaId: string, personId: string, descr: CreateNewPerson, stemmaIndex: StemmaIndex): Promise<Stemma> {
        return this.send<Stemma>(
            { type: "UpdatePersonRequest", stemmaId, personId, personDescr: sanitizeRequestPayload(descr) as CreateNewPerson },
            stemmaIndex,
        )
    }

    async cloneStemma(stemmaId: string, name: string): Promise<CloneResult> {
        return this.send<CloneResult>({ type: "CloneStemmaRequest", stemmaId, stemmaName: name }, null)
    }

    async renameStemma(stemmaId: string, newName: string): Promise<StemmaDescription> {
        return this.send<StemmaDescription>({ type: "RenameStemmaRequest", stemmaId, newName }, null)
    }

    private async send<R extends StemmaResponse>(request: Request, stemmaIndex: StemmaIndex | null): Promise<R> {
        const response = await fetch(`${this.endpoint}/stemma`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify(request),
        })
        if (response.status === 401) throw new LocalizedError("error.sessionExpired")
        if (!response.ok) throw new LocalizedError("error.unexpectedResponse")
        const body = (await response.json()) as StemmaResponse
        return mapStemmaError(body, (id) => this.describePerson(id, stemmaIndex)) as R
    }

    private describePerson(id: string, stemmaIndex?: StemmaIndex) {
        if (!stemmaIndex) return this.translate("error.noDescription")
        try {
            let pd = stemmaIndex.person(id)
            return pd.name
        } catch (err) {
            return this.translate("error.noDescription")
        }
    }

    private translate(key: string, params?: Record<string, string>) {
        return get(t)(key, params);
    }
}
