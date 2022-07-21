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
        const response = await fetch(`${this.endpoint}/stemma`, {
            method: 'GET',
            headers: this.commonHeader
        })
        return await this.parseResponse<OwnedStemmas>(response);
    }

    async removeStemma(stemmaId) {
        const response = await fetch(`${this.endpoint}/stemma/${encodeURIComponent(stemmaId)}`, {
            method: 'DELETE',
            headers: this.commonHeader
        })
        return await this.parseResponse<OwnedStemmas>(response);
    }

    async getStemma(stemmaId: string) {
        const response = await fetch(`${this.endpoint}/stemma/${encodeURIComponent(stemmaId)}`, {
            method: 'GET',
            headers: this.commonHeader
        })
        return await this.parseResponse<Stemma>(response);
    }

    async createFamily(stemmaId: string, parents: (NewPerson | StoredPerson)[], children: (NewPerson | StoredPerson)[]) {
        let request = {
            "parent1": parents.length > 0 ? this.sanitize(parents[0]) : null,
            "parent2": parents.length > 1 ? this.sanitize(parents[1]) : null,
            "children": children.map(c => this.sanitize(c))
        }

        const response = await fetch(`${this.endpoint}/stemma/${encodeURIComponent(stemmaId)}/family`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify(request)
        })

        return await this.parseResponse<Stemma>(response);
    }

    async updateFamily(stemmaId: string, familyId: string, parents: (NewPerson | StoredPerson)[], children: (NewPerson | StoredPerson)[]) {
        let request = {
            "parent1": parents.length > 0 ? this.sanitize(parents[0]) : null,
            "parent2": parents.length > 1 ? this.sanitize(parents[1]) : null,
            "children": children.map(c => this.sanitize(c))
        }

        const response = await fetch(`${this.endpoint}/stemma/${encodeURIComponent(stemmaId)}/family/${encodeURIComponent(familyId)}`, {
            method: 'PUT',
            headers: this.commonHeader,
            body: JSON.stringify(request)
        })

        return await this.parseResponse<Stemma>(response);
    }

    async addStemma(name: string) {
        const response = await fetch(`${this.endpoint}/stemma`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify({
                "name": name
            })
        })

        return await this.parseResponse<StemmaDescription>(response);
    }

    async removePerson(stemmaId: string, personId: string) {
        const response = await fetch(`${this.endpoint}/stemma/${encodeURIComponent(stemmaId)}/person/${encodeURIComponent(personId)}`, {
            method: 'DELETE',
            headers: this.commonHeader
        })

        return await this.parseResponse<Stemma>(response);
    }

    async removeFamily(stemmaId: string, familyId: string) {
        const response = await fetch(`${this.endpoint}/stemma/${encodeURIComponent(stemmaId)}/family/${encodeURIComponent(familyId)}`, {
            method: 'DELETE',
            headers: this.commonHeader
        })

        return await this.parseResponse<Stemma>(response);
    }

    async updatePerson(stemmaId: string, personId: string, descr: NewPerson) {
        const response = await fetch(`${this.endpoint}/stemma/${encodeURIComponent(stemmaId)}/person/${encodeURIComponent(personId)}`, {
            method: 'PUT',
            headers: this.commonHeader,
            body: JSON.stringify(({
                name: descr.name,
                birthDate: descr.birthDate ? descr.birthDate : null,
                deathDate: descr.deathDate ? descr.deathDate : null,
                bio: descr.bio ? descr.bio : null
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

    private sanitize(obj) {
        return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null && v != ""))
    }
}