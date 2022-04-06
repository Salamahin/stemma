import { Stemma, Person } from "./model";

export type Generation = {
    generation: number,
    relativies: string[]
}

export class Lineage {
    private s: Stemma
    private parentToChildren: Map<string, string[]>
    private childToParents: Map<string, string[]>

    constructor(stemma: Stemma) {
        this.s = stemma

        this.parentToChildren = new Map<string, string[]>(
            stemma.families.flatMap((f) =>
                f.parents.map((p) => [p, f.children])
            )
        );

        this.childToParents = new Map<string, string[]>(
            stemma.families.flatMap((f) =>
                f.children.map((p) => [p, f.parents])
            )
        );
    }

    private computeGenerations(generation: number, parents: string[]): number {
        if (!parents.length) return generation
        return this.computeGenerations(generation + 1, parents.flatMap(p => this.childToParents.get(p)))
    }

    private computeLineage(toLookUp: string[], acc: string[], relation: Map<string, string[]>): string[] {
        if (!toLookUp.length) return acc;

        let [head, ...tail] = toLookUp;
        let nextGen = relation.get(head);

        return this.computeLineage([...nextGen, ...tail], [head, ...acc], relation);
    }

    private lineage(p: Person): Generation {
        let lg = [...this.computeLineage([p.id], [], this.parentToChildren), ...this.computeLineage([p.id], [], this.childToParents)];
        let generation = this.computeGenerations(0, this.childToParents.get(p.id))

        return {
            generation: generation,
            relativies: lg
        }
    }

    lineages(): Map<string, Generation> {
        return new Map<string, Generation>(
            this.s.people.map(p => [p.id, this.lineage(p)])
        )
    }
}