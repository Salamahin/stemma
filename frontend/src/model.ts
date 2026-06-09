import { StemmaIndex } from "./stemmaIndex"
import { get } from "svelte/store";
import { LocalizedError, t } from "./i18n";
import { PERSON_PRESERVE_KEYS, sanitizeRequestPayload } from "./requestSanitizer";
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
export type ListDescribeStemmasRequest = { type: "ListDescribeStemmasRequest", defaultStemmaName: string, kingsOfEuropeStemmaName: string }
export type RenameStemmaRequest = { type: "RenameStemmaRequest", stemmaId: string, newName: string }
export type RequestPhotoUploadUrlRequest = { type: "RequestPhotoUploadUrlRequest", stemmaId: string, personId: string, contentType: string }
export type SetPersonPhotoRequest = { type: "SetPersonPhotoRequest", stemmaId: string, personId: string, photoKey: string | null }
export type CreateOrphanPersonRequest = { type: "CreateOrphanPersonRequest", stemmaId: string, personDescr: CreateNewPerson }
export type LinkRole = "spouse" | "parent" | "child"
export type LinkPersonsRequest = { type: "LinkPersonsRequest", stemmaId: string, fromPersonId: string, toPersonId: string, role: LinkRole }
export type AuthLoginRequest = { type: "AuthLoginRequest", idToken: string }
export type AuthLogoutRequest = { type: "AuthLogoutRequest" }

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
    | RequestPhotoUploadUrlRequest
    | SetPersonPhotoRequest
    | CreateOrphanPersonRequest
    | LinkPersonsRequest
    | AuthLoginRequest
    | AuthLogoutRequest


//responses
export type FamilyDescription = { type: "FamilyDescription", id: string, parents: Array<string>, children: Array<string>, readOnly: boolean }
export type InviteToken = { type: "InviteToken", token: string }
export type OwnedStemmas = { type: "OwnedStemmas", stemmas: Array<StemmaDescription>, firstStemma: Stemma, defaultStemmaId?: string | null }
export type Stemma = { type: "Stemma", people: Array<PersonDescription>, families: Array<FamilyDescription> }
export type StemmaDescription = { type: "StemmaDescription", id: string, name: string, removable: Boolean }
export type PersonDescription = { type: "PersonDescription", id: string, name: string, birthDate?: string, deathDate?: string, bio?: string, readOnly: boolean, photoUrl?: string | null }
export type TokenAccepted = { type: "TokenAccepted", stemmas: Array<StemmaDescription>, lastStemma: Stemma }
export type CloneResult = { type: "CloneResult", createdStemma: Stemma, stemmas: Array<StemmaDescription> }
export type PhotoUploadUrl = { type: "PhotoUploadUrl", uploadUrl: string, photoKey: string, expiresInSeconds: number }
export type AuthLoginResponse = { type: "AuthLoginResponse", userId: string, email: string }
export type AuthLogoutResponse = { type: "AuthLogoutResponse" }

//errors
export type UnknownError = { type: "UnknownError", cause: string }
export type RequestDeserializationProblem = { type: "RequestDeserializationProblem", descr: string }
export type UnsupportedPhotoType = { type: "UnsupportedPhotoType", contentType: string }
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
export type AmbiguousLinkTarget = { type: "AmbiguousLinkTarget", personId: string }
export type SpouseLinkAlreadyExists = { type: "SpouseLinkAlreadyExists", familyId: string }
export type TooManyParents = { type: "TooManyParents", familyId: string }

export type StemmaResponse =
    | FamilyDescription
    | InviteToken
    | OwnedStemmas
    | Stemma
    | StemmaDescription
    | PersonDescription
    | TokenAccepted
    | CloneResult
    | PhotoUploadUrl
    | AuthLoginResponse
    | AuthLogoutResponse
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
    | UnsupportedPhotoType
    | AmbiguousLinkTarget
    | SpouseLinkAlreadyExists
    | TooManyParents

export class Model {
    endpoint: string;

    constructor(endpoint: string) {
        this.endpoint = endpoint
    }

    private headers() {
        return {
            'Content-Type': 'application/json; charset=UTF-8',
        }
    }

    async login(idToken: string): Promise<AuthLoginResponse> {
        return this.send<AuthLoginResponse>({ type: "AuthLoginRequest", idToken }, null)
    }

    async logout(): Promise<AuthLogoutResponse> {
        return this.send<AuthLogoutResponse>({ type: "AuthLogoutRequest" }, null)
    }

    async listDescribeStemmas(): Promise<OwnedStemmas> {
        return this.send<OwnedStemmas>(
            {
                type: "ListDescribeStemmasRequest",
                defaultStemmaName: this.translate("stemma.defaultName"),
                kingsOfEuropeStemmaName: this.translate("stemma.kingsOfEuropeName"),
            },
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
            parent1: parents.length > 0 ? sanitizeRequestPayload(parents[0], PERSON_PRESERVE_KEYS) as PersonDefinition : null,
            parent2: parents.length > 1 ? sanitizeRequestPayload(parents[1], PERSON_PRESERVE_KEYS) as PersonDefinition : null,
            children: children.map(c => sanitizeRequestPayload(c, PERSON_PRESERVE_KEYS) as PersonDefinition),
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
            { type: "UpdatePersonRequest", stemmaId, personId, personDescr: sanitizeRequestPayload(descr, PERSON_PRESERVE_KEYS) as CreateNewPerson },
            stemmaIndex,
        )
    }

    async cloneStemma(stemmaId: string, name: string): Promise<CloneResult> {
        return this.send<CloneResult>({ type: "CloneStemmaRequest", stemmaId, stemmaName: name }, null)
    }

    async renameStemma(stemmaId: string, newName: string): Promise<StemmaDescription> {
        return this.send<StemmaDescription>({ type: "RenameStemmaRequest", stemmaId, newName }, null)
    }

    async requestPhotoUploadUrl(stemmaId: string, personId: string, contentType: string): Promise<PhotoUploadUrl> {
        return this.send<PhotoUploadUrl>(
            { type: "RequestPhotoUploadUrlRequest", stemmaId, personId, contentType },
            null,
        )
    }

    async createOrphanPerson(stemmaId: string, descr: CreateNewPerson): Promise<Stemma> {
        return this.send<Stemma>(
            { type: "CreateOrphanPersonRequest", stemmaId, personDescr: sanitizeRequestPayload(descr, PERSON_PRESERVE_KEYS) as CreateNewPerson },
            null,
        )
    }

    async linkPersons(stemmaId: string, fromPersonId: string, toPersonId: string, role: LinkRole, stemmaIndex: StemmaIndex): Promise<Stemma> {
        return this.send<Stemma>(
            { type: "LinkPersonsRequest", stemmaId, fromPersonId, toPersonId, role },
            stemmaIndex,
        )
    }

    async setPersonPhoto(stemmaId: string, personId: string, photoKey: string | null, stemmaIndex: StemmaIndex): Promise<Stemma> {
        return this.send<Stemma>(
            { type: "SetPersonPhotoRequest", stemmaId, personId, photoKey },
            stemmaIndex,
        )
    }

    async uploadPhotoToPresignedUrl(uploadUrl: string, file: Blob): Promise<void> {
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
        })
        if (!response.ok) throw new LocalizedError("error.unexpectedResponse")
    }

    private async send<R extends StemmaResponse>(request: Request, stemmaIndex: StemmaIndex | null): Promise<R> {
        const body = JSON.stringify(request)
        const response = await fetch(`${this.endpoint}/stemma`, {
            method: 'POST',
            credentials: 'include',
            headers: this.headers(),
            body,
        })
        if (response.status === 401) throw new LocalizedError("error.sessionExpired")
        if (!response.ok) throw new LocalizedError("error.unexpectedResponse")
        const payload = (await response.json()) as StemmaResponse
        return mapStemmaError(payload, (id) => this.describePerson(id, stemmaIndex)) as R
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
