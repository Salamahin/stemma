export type Person = {
    id: string;
    name: string;
    birthDate: string;
    deathDate: string;
}

export type Family = {
    id: string;
    parents: string[];
    children: string[];
}

export type Stemma = {
    people: Person[];
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

    async listGraphs() {
        const response = await fetch(`${this.endpoint}/stemma`, {
            method: 'GET',
            headers: this.commonHeader
        })
        return await this.parseResponse<OwnedStemmas>(response);
    }

    async addGraph(name: string) {
        const response = await fetch(`${this.endpoint}/stemma`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify({
                "name": name
            })
        })

        return await this.parseResponse<StemmaDescription>(response);
    }

    async getStemma(stemmaId: string) {
        const response = await fetch(`${this.endpoint}/stemma/${stemmaId}`, {
            method: 'GET',
            headers: this.commonHeader
        })

        return await this.parseResponse<StemmaDescription>(response);
    }

    private async parseResponse<T>(response: Response) {
        const json = await response.json();
        if (!response.ok)
            throw new Error(`Unexpected response: ${json}`)
        return json as T;
    }
}