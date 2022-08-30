import { StemmaIndex } from "./stemmaIndex"

//requests
export type PersonDefinition = { ExistingPerson?: ExistingPerson, CreateNewPerson?: CreateNewPerson }
export type ExistingPerson = { id: number }
export type CreateNewPerson = { name: string, birthDate?: string, deathDate?: string, bio?: string }

export type CreateFamily = { parent1?: PersonDefinition, parent2?: PersonDefinition, children: Array<PersonDefinition> }

export type CreateFamilyRequest = { stemmaId: number, familyDescr: CreateFamily }
export type CreateInvitationTokenRequest = { stemmaId: number, targetPersonId: number, targetPersonEmail: string }
export type CreateNewStemmaRequest = { stemmaName: string }
export type DeleteFamilyRequest = { stemmaId: number, familyId: number }
export type DeletePersonRequest = { stemmaId: number, personId: number }
export type GetStemmaRequest = { stemmaId: number }
export type DeleteStemmaRequest = { stemmaId: number }
export type UpdatePersonRequest = { stemmaId: number, personId: number, personDescr: CreateNewPerson }
export type UpdateFamilyRequest = { stemmaId: number, familyId: number, familyDescr: CreateFamily }
export type BearInvitationRequest = { encodedToken: string }
export type ListStemmasRequest = {}

type CompositeRequest = {
    CreateFamilyRequest?: CreateFamilyRequest,
    UpdateFamilyRequest?: UpdateFamilyRequest,
    DeleteFamilyRequest?: DeleteFamilyRequest,
    CreateInvitationTokenRequest?: CreateInvitationTokenRequest,
    BearInvitationRequest?: BearInvitationRequest,
    CreateNewStemmaRequest?: CreateNewStemmaRequest,
    GetStemmaRequest?: GetStemmaRequest,
    DeleteStemmaRequest?: DeleteStemmaRequest,
    ListStemmasRequest?: ListStemmasRequest,
    DeletePersonRequest?: DeletePersonRequest,
    UpdatePersonRequest?: UpdatePersonRequest,
}


//responses
export type ChownEffect = { affectedFamilies: Array<number>, affectedPeople: Array<number> }
export type FamilyDescription = { id: number, parents: Array<number>, children: Array<number>, readOnly: boolean }
export type InviteToken = { token: string }
export type OwnedStemmasDescription = { stemmas: Array<StemmaDescription> }
export type Stemma = { people: Array<PersonDescription>, families: Array<FamilyDescription> }
export type StemmaDescription = { id: number, name: string, removable: Boolean }
export type PersonDescription = { id: number, name: string, birthDate?: string, deathDate?: string, bio?: string, readOnly: boolean }
export type TokenAccepted = {}

//errors
export type UnknownError = { cause: string }
export type RequestDeserializationProblem = { descr: string }
export type NoSuchPersonId = { id: number }
export type ChildAlreadyBelongsToFamily = { familyId: number, personId: number }
export type IncompleteFamily = {}
export type DuplicatedIds = { duplicatedIds: number }
export type AccessToFamilyDenied = { familyId: number }
export type AccessToPersonDenied = { personId: number }
export type AccessToStemmaDenied = { stemmaId: number }
export type IsNotTheOnlyStemmaOwner = { stemmaId: number }
export type InvalidInviteToken = {}
export type ForeignInviteToken = {}

type CompositeResponse = {
    ChownEffect?: ChownEffect,
    FamilyDescription?: FamilyDescription,
    InviteToken?: InviteToken,
    OwnedStemmasDescription?: OwnedStemmasDescription,
    Stemma?: Stemma,
    StemmaDescription?: StemmaDescription,
    PersonDescription?: PersonDescription,
    TokenAccepted?: TokenAccepted,
    UnknownError?: UnknownError,
    RequestDeserializationProblem?: RequestDeserializationProblem,
    NoSuchPersonId?: NoSuchPersonId,
    ChildAlreadyBelongsToFamily?: ChildAlreadyBelongsToFamily,
    IncompleteFamily?: IncompleteFamily,
    DuplicatedIds?: DuplicatedIds,
    AccessToFamilyDenied?: AccessToFamilyDenied,
    AccessToPersonDenied?: AccessToPersonDenied,
    AccessToStemmaDenied?: AccessToStemmaDenied,
    IsNotTheOnlyStemmaOwner?: IsNotTheOnlyStemmaOwner,
    InvalidInviteToken?: InvalidInviteToken,
    ForeignInviteToken?: ForeignInviteToken
}

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

    async listStemmas(): Promise<OwnedStemmasDescription> {
        const response = await this.sendRequest({ ListStemmasRequest: {} })
        const x = await this.parseResponse(response, null)
        return x.OwnedStemmasDescription
    }

    async removeStemma(stemmaId: number): Promise<OwnedStemmasDescription> {
        const response = await this.sendRequest({ DeleteStemmaRequest: { stemmaId: stemmaId } })
        return (await this.parseResponse(response)).OwnedStemmasDescription;
    }

    async getStemma(stemmaId: number): Promise<Stemma> {
        const response = await this.sendRequest({ GetStemmaRequest: { stemmaId: stemmaId } })
        return (await this.parseResponse(response, null)).Stemma;
    }

    private makeFamily(parents: PersonDefinition[], children: PersonDefinition[]) {
        let cf = {
            parent1: parents.length > 0 ? this.sanitize(parents[0]) as PersonDefinition : null,
            parent2: parents.length > 1 ? this.sanitize(parents[1]) as PersonDefinition : null,
            children: children.map(c => this.sanitize(c) as PersonDefinition),
        };

        return cf as CreateFamily
    }

    async createFamily(stemmaId: number, parents: PersonDefinition[], children: PersonDefinition[], stemmaIndex: StemmaIndex): Promise<Stemma> {
        const response = await this.sendRequest({ CreateFamilyRequest: { stemmaId: stemmaId, familyDescr: this.makeFamily(parents, children) } })
        return (await this.parseResponse(response, stemmaIndex)).Stemma;
    }

    async updateFamily(stemmaId: number, familyId: number, parents: PersonDefinition[], children: PersonDefinition[],  stemmaIndex: StemmaIndex): Promise<Stemma> {
        const response = await this.sendRequest({ UpdateFamilyRequest: { stemmaId: stemmaId, familyId: familyId, familyDescr: this.makeFamily(parents, children) } })
        return (await this.parseResponse(response, stemmaIndex)).Stemma;
    }

    async addStemma(name: string): Promise<StemmaDescription> {
        const response = await this.sendRequest({ CreateNewStemmaRequest: { stemmaName: name } })
        return (await this.parseResponse(response, null)).StemmaDescription;
    }

    async removePerson(stemmaId: number, personId: number, stemmaIndex: StemmaIndex): Promise<Stemma> {
        const response = await this.sendRequest({ DeletePersonRequest: { stemmaId: stemmaId, personId: personId } })
        return (await this.parseResponse(response, stemmaIndex)).Stemma;
    }

    async createInvintation(stemmaId: number, personId: number, email: string, stemmaIndex: StemmaIndex): Promise<string> {
        const response = await this.sendRequest({ CreateInvitationTokenRequest: { stemmaId: stemmaId, targetPersonId: personId, targetPersonEmail: email } })
        const token = (await this.parseResponse(response, stemmaIndex)).InviteToken
        return `${location.origin}/?inviteToken=${encodeURIComponent(token.token)}`
    }

    async proposeInvitationToken(token: string): Promise<TokenAccepted> {
        const response = await this.sendRequest({ BearInvitationRequest: { encodedToken: token } })
        return (await this.parseResponse(response, null)).TokenAccepted
    }

    async removeFamily(stemmaId: number, familyId: number): Promise<Stemma> {
        const response = await this.sendRequest({ DeleteFamilyRequest: { stemmaId: stemmaId, familyId: familyId } })
        return (await this.parseResponse(response, null)).Stemma
    }

    async updatePerson(stemmaId: number, personId: number, descr: CreateNewPerson, stemmaIndex: StemmaIndex): Promise<Stemma> {
        const response = await this.sendRequest({ UpdatePersonRequest: { stemmaId: stemmaId, personId: personId, personDescr: this.sanitize(descr) as CreateNewPerson } })
        return (await this.parseResponse(response, stemmaIndex)).Stemma
    }

    private async parseResponse(response: Response, stemmaIndex? : StemmaIndex) {
        const json = await response.json();
        if (!response.ok)
            throw new Error(`Unexpected response: ${json}`)
        return this.translateError(json as CompositeResponse, stemmaIndex);
    }

    private async sendRequest(request: CompositeRequest) {
        return fetch(`${this.endpoint}/stemma`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify(request)
        })
    }

    private describePerson(id: number, stemmaIndex?: StemmaIndex) {
        if (!stemmaIndex) return "[НЕТ ОПИСАНИЯ]"
        try {
            let pd = stemmaIndex.person(id)
            return `[${pd.name}]`
        } catch (err) {
            return "[НЕТ ОПИСАНИЯ]"
        }
    }

    private translateError(response: CompositeResponse, stemmaIndex?: StemmaIndex) {
        console.log(response)
        
        if (response.UnknownError) throw new Error("Что-то пошло не так. Попробуйте перезагрузить страницу")
        if (response.RequestDeserializationProblem) throw new Error("Невалидный запрос, как у тебя удалось-то такой послать вообще?!")
        if (response.NoSuchPersonId) throw new Error(`Вы указали неизвестного человека ${this.describePerson(response.NoSuchPersonId.id), stemmaIndex}, возможно, его уже удалили?`)
        if (response.ChildAlreadyBelongsToFamily) throw new Error(`У ${this.describePerson(response.ChildAlreadyBelongsToFamily.personId, stemmaIndex)}, уже есть родители, вы не можете добавить его в семью`)
        if (response.IncompleteFamily) throw new Error("Нельзя создать семью, в которой меньше 2 людей")
        if (response.DuplicatedIds) throw new Error(`Нельзя указать одного и того же человека ${this.describePerson(response.DuplicatedIds.duplicatedIds, stemmaIndex)} в семье дважды`)
        if (response.AccessToFamilyDenied) throw new Error("Действие с семьей запрещено")
        if (response.AccessToPersonDenied) throw new Error(`Действие с человеком ${this.describePerson(response.AccessToPersonDenied.personId, stemmaIndex)} запрещено`)
        if (response.AccessToStemmaDenied) throw new Error("Действие с родословной запрещено")
        if (response.InvalidInviteToken) throw new Error("Проверьте правильность ссылки-приглашения")
        if (response.ForeignInviteToken) throw new Error("Похоже, вы используете чужую ссылку-приглашение")

        return response
    }

    private sanitize(obj) {
        return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v != ""))
    }
}