import { Stemma, Person } from "./model";

export type Generation = {
    generation: number,
    relativies: string[]
};

export class Lineage {
    private stemma: Stemma
    private parentToChildren: Map<string, string[]>
    private childToParents: Map<string, string[]>

    constructor(stemma: Stemma) {
        this.stemma = stemma

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
        'use strict';
        console.log(toLookUp)
        if (!toLookUp.length) return acc;

        let [head, ...tail] = toLookUp;
        let nextGen = relation.has(head) ? relation.get(head) : [];

        return this.computeLineage([...nextGen, ...tail], [head, ...acc], relation);
    }

    private lineage(p: Person): Generation {
        let dependees = this.computeLineage([p.id], [], this.parentToChildren)
        let ancestors = this.computeLineage(this.childToParents.has(p.id) ? this.childToParents.get(p.id) : [], [], this.childToParents)

        let generation = this.computeGenerations(0, this.childToParents.has(p.id) ? this.childToParents.get(p.id) : [])

        return {
            generation: generation,
            relativies: [...ancestors, ...dependees]
        }
    }

    lineages(): Map<string, Generation> {
        return new Map<string, Generation>(
            this.stemma.people.map(p => [p.id, this.lineage(p)])
        )
    }
}