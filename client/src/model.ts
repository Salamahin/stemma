export type User = {
    id_token: string;
    image_url: string;
    name: string;
};

export type Graph = {
    id: string,
    name: string
}

export type OwnedGraphs = {
    graphs: Graph[]
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
        const response = await fetch(`${this.endpoint}/graph`, {
            method: 'GET',
            headers: this.commonHeader
        })
        return await this.parseResponse<OwnedGraphs>(response);
    }

    async addGraph(name: String) {
        const response = await fetch(`${this.endpoint}/graph`, {
            method: 'POST',
            headers: this.commonHeader,
            body: JSON.stringify({
                "name": name
            })
        })

        return await this.parseResponse<Graph>(response);
    }

    private async parseResponse<T>(response: Response) {
        const json = await response.json();
        if (!response.ok)
            throw new Error(`Unexpected response: ${json}`)
        return json as T;
    }
}