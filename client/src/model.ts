import { StemmaIndex } from "./stemmaIndex"

//requests
export type PersonDefinition = { ExistingPerson?: ExistingPerson, CreateNewPerson?: CreateNewPerson }
export type ExistingPerson = { id: string }
export type CreateNewPerson = { name: string, birthDate?: string, deathDate?: string, bio?: string }

export type CreateFamily = { parent1?: PersonDefinition, parent2?: PersonDefinition, children: Array<PersonDefinition> }

export type CreateFamilyRequest = { stemmaId: string, familyDescr: CreateFamily }
export type CreateInvitationTokenRequest = { stemmaId: string, targetPersonId: string, targetPersonEmail: string }
export type CreateNewStemmaRequest = { stemmaName: string }
export type DeleteFamilyRequest = { stemmaId: string, familyId: string }
export type DeletePersonRequest = { stemmaId: string, personId: string }
export type GetStemmaRequest = { stemmaId: string }
export type DeleteStemmaRequest = { stemmaId: string }
export type UpdatePersonRequest = { stemmaId: string, personId: string, personDescr: CreateNewPerson }
export type UpdateFamilyRequest = { stemmaId: string, familyId: string, familyDescr: CreateFamily }
export type BearInvitationRequest = { encodedToken: string }
export type CloneStemmaRequest = { stemmaId: string, stemmaName: string }
export type ListDescribeStemmasRequest = { defaultStemmaName: string }

type CompositeRequest = {
    CreateFamilyRequest?: CreateFamilyRequest,
    UpdateFamilyRequest?: UpdateFamilyRequest,
    DeleteFamilyRequest?: DeleteFamilyRequest,
    CreateInvitationTokenRequest?: CreateInvitationTokenRequest,
    BearInvitationRequest?: BearInvitationRequest,
    CreateNewStemmaRequest?: CreateNewStemmaRequest,
    GetStemmaRequest?: GetStemmaRequest,
    DeleteStemmaRequest?: DeleteStemmaRequest,
    ListDescribeStemmasRequest?: ListDescribeStemmasRequest,
    DeletePersonRequest?: DeletePersonRequest,
    UpdatePersonRequest?: UpdatePersonRequest,
    CloneStemmaRequest?: CloneStemmaRequest
}


//responses
export type ChownEffect = { affectedFamilies: Array<string>, affectedPeople: Array<string> }
export type FamilyDescription = { id: string, parents: Array<string>, children: Array<string>, readOnly: boolean }
export type InviteToken = { token: string }
export type OwnedStemmas = { stemmas: Array<StemmaDescription>, firstStemma: Stemma }
export type Stemma = { people: Array<PersonDescription>, families: Array<FamilyDescription> }
export type StemmaDescription = { id: string, name: string, removable: Boolean }
export type PersonDescription = { id: string, name: string, birthDate?: string, deathDate?: string, bio?: string, readOnly: boolean }
export type TokenAccepted = { stemmas: Array<StemmaDescription>, lastStemma: Stemma }
export type CloneResult = { createdStemma: Stemma, stemmas: Array<StemmaDescription> }

//errors
export type UnknownError = { cause: string }
export type RequestDeserializationProblem = { descr: string }
export type NoSuchPersonId = { id: string }
export type ChildAlreadyBelongsToFamily = { familyId: string, personId: string }
export type IncompleteFamily = {}
export type DuplicatedIds = { duplicatedIds: string }
export type AccessToFamilyDenied = { familyId: string }
export type AccessToPersonDenied = { personId: string }
export type AccessToStemmaDenied = { stemmaId: string }
export type IsNotTheOnlyStemmaOwner = { stemmaId: string }
export type InvalidInviteToken = {}
export type ForeignInviteToken = {}
export type StemmaHasCycles = {}

type CompositeResponse = {
    ChownEffect?: ChownEffect,
    FamilyDescription?: FamilyDescription,
    InviteToken?: InviteToken,
    OwnedStemmas?: OwnedStemmas,
    Stemma?: Stemma,
    StemmaDescription?: StemmaDescription,
    PersonDescription?: PersonDescription,
    TokenAccepted?: TokenAccepted,
    CloneResult?: CloneResult,
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
    ForeignInviteToken?: ForeignInviteToken,
    StemmaHasCycles?: StemmaHasCycles
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

    async listDescribeStemmas(): Promise<OwnedStemmas> {
        const response = await this.sendRequest({ ListDescribeStemmasRequest: { defaultStemmaName: "Моя родословная" } })
        const x = await this.parseResponse(response, null)
        return x.OwnedStemmas
    }

    async removeStemma(stemmaId: string): Promise<OwnedStemmas> {
        const response = await this.sendRequest({ DeleteStemmaRequest: { stemmaId: stemmaId } })
        return (await this.parseResponse(response)).OwnedStemmas;
    }

    async getStemma(stemmaId: string): Promise<Stemma> {
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

    async createFamily(stemmaId: string, parents: PersonDefinition[], children: PersonDefinition[], stemmaIndex: StemmaIndex): Promise<Stemma> {
        const response = await this.sendRequest({ CreateFamilyRequest: { stemmaId: stemmaId, familyDescr: this.makeFamily(parents, children) } })
        return (await this.parseResponse(response, stemmaIndex)).Stemma;
    }

    async updateFamily(stemmaId: string, familyId: string, parents: PersonDefinition[], children: PersonDefinition[], stemmaIndex: StemmaIndex): Promise<Stemma> {
        const response = await this.sendRequest({ UpdateFamilyRequest: { stemmaId: stemmaId, familyId: familyId, familyDescr: this.makeFamily(parents, children) } })
        return (await this.parseResponse(response, stemmaIndex)).Stemma;
    }

    async addStemma(name: string): Promise<StemmaDescription> {
        const response = await this.sendRequest({ CreateNewStemmaRequest: { stemmaName: name } })
        return (await this.parseResponse(response, null)).StemmaDescription;
    }

    async removePerson(stemmaId: string, personId: string, stemmaIndex: StemmaIndex): Promise<Stemma> {
        const response = await this.sendRequest({ DeletePersonRequest: { stemmaId: stemmaId, personId: personId } })
        return (await this.parseResponse(response, stemmaIndex)).Stemma;
    }

    async createInvintation(stemmaId: string, personId: string, email: string, stemmaIndex: StemmaIndex): Promise<string> {
        const response = await this.sendRequest({ CreateInvitationTokenRequest: { stemmaId: stemmaId, targetPersonId: personId, targetPersonEmail: email } })
        const token = (await this.parseResponse(response, stemmaIndex)).InviteToken
        return `${location.origin}/?inviteToken=${encodeURIComponent(token.token)}`
    }

    async bearInvitationToken(token: string): Promise<TokenAccepted> {
        const response = await this.sendRequest({ BearInvitationRequest: { encodedToken: token } })
        return (await this.parseResponse(response, null)).TokenAccepted
    }

    async removeFamily(stemmaId: string, familyId: string): Promise<Stemma> {
        const response = await this.sendRequest({ DeleteFamilyRequest: { stemmaId: stemmaId, familyId: familyId } })
        return (await this.parseResponse(response, null)).Stemma
    }

    async updatePerson(stemmaId: string, personId: string, descr: CreateNewPerson, stemmaIndex: StemmaIndex): Promise<Stemma> {
        const response = await this.sendRequest({ UpdatePersonRequest: { stemmaId: stemmaId, personId: personId, personDescr: this.sanitize(descr) as CreateNewPerson } })
        return (await this.parseResponse(response, stemmaIndex)).Stemma
    }

    async cloneStemma(stemmaId: string, name: string): Promise<CloneResult> {
        const response = await this.sendRequest({ CloneStemmaRequest: { stemmaId: stemmaId, stemmaName: name } })
        return (await this.parseResponse(response)).CloneResult
    }

    private async parseResponse(response: Response, stemmaIndex?: StemmaIndex) {
        const json = await response.json();
        
        if(response.status === 401) {
            throw new Error("Сессия успела протухнуть. Авторизуйтесь заново (перезагрузите страницу)")
        }

        if (!response.ok) {
            console.error(json)
            throw new Error(`Получен неожиданный ответ от сервера. Попробуйте перезагрузить страницу`)
        }
        
        return this.translateError(json as CompositeResponse, stemmaIndex);
    }

    private async sendRequest(request: CompositeRequest) {
        return fetch(`${this.endpoint}/stemma`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify(request)
        })
    }

    private describePerson(id: string, stemmaIndex?: StemmaIndex) {
        if (!stemmaIndex) return "[НЕТ ОПИСАНИЯ]"
        try {
            let pd = stemmaIndex.person(id)
            return `[${pd.name}]`
        } catch (err) {
            return "[НЕТ ОПИСАНИЯ]"
        }
    }

    private translateError(response: CompositeResponse, stemmaIndex?: StemmaIndex) {
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
        if (response.StemmaHasCycles) throw new Error("Неверная композиция семьи - обнаружена циклическая зависимость")

        return response
    }

    private sanitize(obj) {
        return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v != ""))
    }
}