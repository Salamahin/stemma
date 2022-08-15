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

type CompositeResponse = {
    ChownEffect?: ChownEffect,
    FamilyDescription?: FamilyDescription,
    InviteToken?: InviteToken,
    OwnedStemmasDescription?: OwnedStemmasDescription,
    Stemma?: Stemma,
    StemmaDescription?: StemmaDescription,
    PersonDescription?: PersonDescription,
    TokenAccepted?: TokenAccepted
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
        return (await this.parseResponse(response)).OwnedStemmasDescription;
    }

    async removeStemma(stemmaId: number): Promise<OwnedStemmasDescription> {
        const response = await this.sendRequest({ DeleteStemmaRequest: { stemmaId: stemmaId } })
        return (await this.parseResponse(response)).OwnedStemmasDescription;
    }

    async getStemma(stemmaId: number): Promise<Stemma> {
        const response = await this.sendRequest({ GetStemmaRequest: { stemmaId: stemmaId } })
        return (await this.parseResponse(response)).Stemma;
    }

    private makeFamily(parents: PersonDefinition[], children: PersonDefinition[]) {
        let cf = {
            parent1: parents.length > 0 ? this.sanitize(parents[0]) as PersonDefinition : null,
            parent2: parents.length > 1 ? this.sanitize(parents[1]) as PersonDefinition : null,
            children: children.map(c => this.sanitize(c) as PersonDefinition),
        };

        return cf as CreateFamily
    }

    async createFamily(stemmaId: number, parents: PersonDefinition[], children: PersonDefinition[]): Promise<Stemma> {
        const response = await this.sendRequest({ CreateFamilyRequest: { stemmaId: stemmaId, familyDescr: this.makeFamily(parents, children) } })
        return (await this.parseResponse(response)).Stemma;
    }

    async updateFamily(stemmaId: number, familyId: number, parents: PersonDefinition[], children: PersonDefinition[]): Promise<Stemma> {
        const response = await this.sendRequest({ UpdateFamilyRequest: { stemmaId: stemmaId, familyId: familyId, familyDescr: this.makeFamily(parents, children) } })
        return (await this.parseResponse(response)).Stemma;
    }

    async addStemma(name: string): Promise<StemmaDescription> {
        const response = await this.sendRequest({ CreateNewStemmaRequest: { stemmaName: name } })
        return (await this.parseResponse(response)).StemmaDescription;
    }

    async removePerson(stemmaId: number, personId: number): Promise<Stemma> {
        const response = await this.sendRequest({ DeletePersonRequest: { stemmaId: stemmaId, personId: personId } })
        return (await this.parseResponse(response)).Stemma;
    }

    async createInvintation(stemmaId: number, personId: number, email: string): Promise<string> {
        const response = await this.sendRequest({ CreateInvitationTokenRequest: { stemmaId: stemmaId, targetPersonId: personId, targetPersonEmail: email } })
        const token = (await this.parseResponse(response)).InviteToken
        return `${location.origin}/?inviteToken=${encodeURIComponent(token.token)}`
    }

    async proposeInvitationToken(token: string): Promise<TokenAccepted> {
        const response = await this.sendRequest({ BearInvitationRequest: { encodedToken: token } })
        return (await this.parseResponse(response)).TokenAccepted
    }

    async removeFamily(stemmaId: number, familyId: number): Promise<Stemma> {
        const response = await this.sendRequest({ DeleteFamilyRequest: { stemmaId: stemmaId, familyId: familyId } })
        return (await this.parseResponse(response)).Stemma
    }

    async updatePerson(stemmaId: number, personId: number, descr: CreateNewPerson): Promise<Stemma> {
        const response = await this.sendRequest({ UpdatePersonRequest: { stemmaId: stemmaId, personId: personId, personDescr: descr } })
        return (await this.parseResponse(response)).Stemma
    }

    private async parseResponse(response: Response) {
        const json = await response.json();
        if (!response.ok)
            throw new Error(`Unexpected response: ${json}`)
        return json as CompositeResponse;
    }

    private async sendRequest(request: CompositeRequest) {
        return await fetch(`${this.endpoint}/stemma`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify(request)
        })
    }

    private sanitize(obj) {
        return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v != ""))
    }
}