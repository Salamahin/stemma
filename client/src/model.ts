//requests
export type PersonDefinition = ExistingPerson | CreateNewPerson
export type ExistingPerson = { id: string }
export type CreateNewPerson = { name: string, birthDate?: string, deathDate?: string, bio?: string }

export type CreateFamily = { parent1?: PersonDefinition, parent2?: PersonDefinition, children: Array<PersonDefinition> }

export type CreateFamilyRequest = { stemmaId: string, familyDescr: CreateFamily }
export type CreateInvitationTokenRequest = { targetPersonId: string, targetPersonEmail: string }
export type CreateNewStemmaRequest = { stemmaName: string }
export type DeleteFamilyRequest = { stemmaId: string, familyId: string }
export type DeletePersonRequest = { stemmaId: string, personId: string }
export type GetStemmaRequest = { stemmaId: string }
export type DeleteStemmaRequest = { stemmaId: string }
export type UpdatePersonRequest = { stemmaId: string, personId: string, personDescr: CreateNewPerson }
export type UpdateFamilyRequest = { stemmaId: string, familyId: string, familyDescr: CreateFamily }
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
export type ChownEffect = { affectedFamilies: Array<string>, affectedPeople: Array<string> }
export type FamilyDescription = { id: string, parents: Array<string>, children: Array<string>, readOnly: boolean }
export type InviteToken = { token: string }
export type OwnedStemmasDescription = { stemmas: Array<StemmaDescription> }
export type Stemma = { people: Array<PersonDescription>, families: Array<FamilyDescription> }
export type StemmaDescription = { id: string, name: string, removable: Boolean }
export type PersonDescription = { id: string, name: string, birthDate?: string, deathDate?: string, bio?: string, readOnly: boolean }
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

    async removeStemma(stemmaId: string): Promise<OwnedStemmasDescription> {
        const response = await this.sendRequest({ DeleteStemmaRequest: { stemmaId: stemmaId } })
        return (await this.parseResponse(response)).OwnedStemmasDescription;
    }

    async getStemma(stemmaId: string): Promise<Stemma> {
        const response = await this.sendRequest({ GetStemmaRequest: { stemmaId: stemmaId } })
        return (await this.parseResponse(response)).Stemma;
    }

    private makeFamily(parents: PersonDefinition[], children: PersonDefinition[]) {
        let cf = {
            parent1: parents.length > 0 ? this.sanitize(parents[0]) : null,
            parent2: parents.length > 1 ? this.sanitize(parents[1]) : null,
            children: children.map(c => this.sanitize(c)),
        };

        return cf as CreateFamily
    }

    async createFamily(stemmaId: string, parents: PersonDefinition[], children: PersonDefinition[]): Promise<Stemma> {
        const response = await this.sendRequest({ CreateFamilyRequest: { stemmaId: stemmaId, familyDescr: this.makeFamily(parents, children) } })
        return (await this.parseResponse(response)).Stemma;
    }

    async updateFamily(stemmaId: string, familyId: string, parents: PersonDefinition[], children: PersonDefinition[]): Promise<Stemma> {
        const response = await this.sendRequest({ UpdateFamilyRequest: { stemmaId: stemmaId, familyId: familyId, familyDescr: this.makeFamily(parents, children) } })
        return (await this.parseResponse(response)).Stemma;
    }

    async addStemma(name: string): Promise<StemmaDescription> {
        const response = await this.sendRequest({ CreateNewStemmaRequest: { stemmaName: name } })
        return (await this.parseResponse(response)).StemmaDescription;
    }

    async removePerson(stemmaId: string, personId: string): Promise<Stemma> {
        const response = await this.sendRequest({ DeletePersonRequest: { stemmaId: stemmaId, personId: personId } })
        return (await this.parseResponse(response)).Stemma;
    }

    async createInvintation(personId: string, email: string): Promise<string> {
        const response = await this.sendRequest({ CreateInvitationTokenRequest: { targetPersonId: personId, targetPersonEmail: email } })
        const token = (await this.parseResponse(response)).InviteToken
        return `${location.origin}/?inviteToken=${encodeURIComponent(token.token)}`
    }

    async proposeInvitationToken(token: string): Promise<TokenAccepted> {
        const response = await this.sendRequest({ BearInvitationRequest: { encodedToken: token } })
        return (await this.parseResponse(response)).TokenAccepted
    }

    async removeFamily(stemmaId: string, familyId: string): Promise<Stemma> {
        const response = await this.sendRequest({ DeleteFamilyRequest: { stemmaId: stemmaId, familyId: familyId } })
        return (await this.parseResponse(response)).Stemma
    }

    async updatePerson(stemmaId: string, personId: string, descr: CreateNewPerson): Promise<Stemma> {
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