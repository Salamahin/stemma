export type NewPerson = {
    name: string;
    birthDate?: string;
    deathDate?: string;
    bio?: string
}

export type StoredPerson = {
    id: string;
    name: string;
    birthDate?: string;
    deathDate?: string;
    bio?: string;
    readOnly: boolean
}

export type Family = {
    id: string;
    parents: string[];
    children: string[];
    readOnly: boolean
}

export type Stemma = {
    people: StoredPerson[];
    families: Family[];
}

export type User = {
    id_token: string;
    image_url: string;
    name: string;
};

export type StemmaDescription = {
    id: string,
    name: string
}

export type OwnedStemmas = {
    stemmas: StemmaDescription[]
}

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

    async listStemmas() {
        const response = await fetch(`${this.endpoint}/stemmas`, {
            method: 'GET',
            headers: this.commonHeader
        })
        return await this.parseResponse<OwnedStemmas>(response);
    }

    async removeStemma(stemmaId) {
        const response = await fetch(`${this.endpoint}/stemma`, {
            method: 'DELETE',
            headers: this.commonHeader,
            body: stemmaId
        })
        return await this.parseResponse<OwnedStemmas>(response);
    }

    async getStemma(stemmaId: string) {
        const response = await fetch(`${this.endpoint}/stemma/get`, {
            method: 'POST',
            headers: this.commonHeader,
            body: stemmaId
        })
        return await this.parseResponse<Stemma>(response);
    }

    async createFamily(stemmaId: string, parents: (NewPerson | StoredPerson)[], children: (NewPerson | StoredPerson)[]) {
        let request = {
            "parent1": parents.length > 0 ? this.sanitize(parents[0]) : null,
            "parent2": parents.length > 1 ? this.sanitize(parents[1]) : null,
            "children": children.map(c => this.sanitize(c))
        }

        const response = await fetch(`${this.endpoint}/family`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify({ stemmaId: stemmaId, familyDescr: request })
        })

        return await this.parseResponse<Stemma>(response);
    }

    async updateFamily(stemmaId: string, familyId: string, parents: (NewPerson | StoredPerson)[], children: (NewPerson | StoredPerson)[]) {
        let request = {
            "parent1": parents.length > 0 ? this.sanitize(parents[0]) : null,
            "parent2": parents.length > 1 ? this.sanitize(parents[1]) : null,
            "children": children.map(c => this.sanitize(c))
        }

        const response = await fetch(`${this.endpoint}/family`, {
            method: 'PUT',
            headers: this.commonHeader,
            body: JSON.stringify({ stemmaId: stemmaId, familyId: familyId, familyDescr: request })
        })

        return await this.parseResponse<Stemma>(response);
    }

    async addStemma(name: string) {
        const response = await fetch(`${this.endpoint}/stemma`, {
            method: 'POST',
            headers: this.commonHeader,
            body: name
        })

        return await this.parseResponse<StemmaDescription>(response);
    }

    async removePerson(stemmaId: string, personId: string) {
        const response = await fetch(`${this.endpoint}/person`, {
            method: 'DELETE',
            headers: this.commonHeader,
            body: JSON.stringify({ stemmaId: stemmaId, personId: personId })
        })

        return await this.parseResponse<Stemma>(response);
    }

    async createInvintation(stemmaId: string, personId: string, email: string) {
        const response = await fetch(`${this.endpoint}/invite/create`, {
            method: 'POST',
            body: JSON.stringify({ targetPersonId: personId, targetPersonEmail: email }),
            headers: this.commonHeader
        })

        return await this.parseResponse<string>(response).then(token => `${location.origin}/?inviteToken=${encodeURIComponent(token)}`);
    }

    async proposeInvitationToken(token: string) {
        const response = await fetch(`${this.endpoint}/invite`, {
            method: 'PUT',
            body: decodeURIComponent(token),
            headers: this.commonHeader
        })

        await this.discardResponse(response);
    }

    async removeFamily(stemmaId: string, familyId: string) {
        const response = await fetch(`${this.endpoint}/family`, {
            method: 'DELETE',
            headers: this.commonHeader,
            body: JSON.stringify({ stemmaId: stemmaId, familyId: familyId })
        })

        return await this.parseResponse<Stemma>(response);
    }

    async updatePerson(stemmaId: string, personId: string, descr: NewPerson) {
        const response = await fetch(`${this.endpoint}/person`, {
            method: 'PUT',
            headers: this.commonHeader,
            body: JSON.stringify((
                {
                    stemmaId: stemmaId, personId: personId, personDescr: {
                        name: descr.name,
                        birthDate: descr.birthDate ? descr.birthDate : null,
                        deathDate: descr.deathDate ? descr.deathDate : null,
                        bio: descr.bio ? descr.bio : null
                    }
                }))
        })

        return await this.parseResponse<Stemma>(response);
    }

    private async parseResponse<T>(response: Response) {
        const json = await response.json();
        if (!response.ok)
            throw new Error(`Unexpected response: ${json}`)
        return json as T;
    }

    private async discardResponse(response: Response) {
        const json = await response.json();
        if (!response.ok)
            throw new Error(`Unexpected response: ${json}`)
    }

    private sanitize(obj) {
        return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v != ""))
    }
}