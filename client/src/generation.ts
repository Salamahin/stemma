import { Stemma, Person } from "./model";

export type Generation = {
    generation: number,
    relativies: Set<string>
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

    private computeGenerations(parents: string[]): number {
        var generation = 0
        while (parents.length) {
            generation++
            parents = parents.flatMap(p => this.childToParents.get(p))
        }

        return generation
    }

    private computeLineage(personId: string, relation: Map<string, string[]>) {
        var foundRelatieves: Array<string> = []
        var toLookUp = [personId]
        var depth = 0

        while (toLookUp.length) {
            let [head, ...tail] = toLookUp
            var nextGen: Array<string> = []
            if (relation.has(head)) {
                depth++
                nextGen = relation.get(head)
            }

            toLookUp = [...nextGen, ...tail]
            foundRelatieves = [head, ...foundRelatieves]
        }

        return {
            depth: depth,
            relativies: foundRelatieves
        }
    }

    private lineage(p: Person): Generation {
        let dependees = this.computeLineage(p.id, this.parentToChildren)
        let ancestors = this.computeLineage(p.id, this.childToParents)

        let generation = ancestors.depth

        return {
            generation: generation,
            relativies: new Set([...ancestors.relativies, ...dependees.relativies])
        }
    }

    lineages(): Map<string, Generation> {
        return new Map<string, Generation>(
            this.stemma.people.map(p => [p.id, this.lineage(p)])
        )
    }
}