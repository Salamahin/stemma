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
        });


        console.log(response.body)

        throw new Error("wtf")

        // const body = new TextDecoder("utf-8").decode(response.body);

        // if (!response.ok)
        //     throw new Error(`Unexpected response: ${body}`)

        // return JSON.parse(body) as OwnedGraphs;
    }

}