import { Stemma, StoredPerson } from "./model";

export type Generation = {
    generation: number,
    relativies: Set<string>
    families: Set<string>
};

type FamilyDescription = {
    familyId: string,
    members: string[]
}

type GenerationDescription = {
    personId: string,
    depth: number
}

export class Lineage {
    private stemma: Stemma
    private parentToChildren: Map<string, FamilyDescription>
    private childToParents: Map<string, FamilyDescription>

    constructor(stemma: Stemma) {
        this.stemma = stemma

        this.parentToChildren = new Map<string, FamilyDescription>(
            stemma.families.flatMap((f) =>
                f.parents.map((p) => [p, ({ familyId: f.id, members: f.children })])
            )
        );

        this.childToParents = new Map<string, FamilyDescription>(
            stemma.families.flatMap((f) =>
                f.children.map((p) => [p, ({ familyId: f.id, members: f.parents })])
            )
        );
    }

    private computeLineage(personId: string, relation: Map<string, FamilyDescription>) {
        var foundRelatieves: string[] = []
        var foundFamilies: string[] = []
        var toLookUp = [{ personId: personId, depth: 0 }]
        var maxDepth = 0

        while (toLookUp.length) {
            let [head, ...tail] = toLookUp
            var nextGen: GenerationDescription[] = []

            if (relation.has(head.personId)) {
                let nextDepth = head.depth + 1
                let descr = relation.get(head.personId)

                maxDepth = Math.max(maxDepth, nextDepth)
                nextGen = descr.members.map(personId => ({ personId: personId, depth: nextDepth }))
                foundFamilies = [descr.familyId, ...foundFamilies]
            }

            toLookUp = [...nextGen, ...tail]
            foundRelatieves = [head.personId, ...foundRelatieves]
        }

        return {
            depth: maxDepth,
            relativies: foundRelatieves,
            families: foundFamilies
        }
    }

    private lineage(p: StoredPerson): Generation {
        let dependees = this.computeLineage(p.id, this.parentToChildren)
        let ancestors = this.computeLineage(p.id, this.childToParents)

        let generation = ancestors.depth

        return {
            generation: generation,
            relativies: new Set([...ancestors.relativies, ...dependees.relativies]),
            families: new Set([...ancestors.families, ...dependees.families])
        }
    }

    lineages(): Map<string, Generation> {
        return new Map<string, Generation>(
            this.stemma.people.map(p => [p.id, this.lineage(p)])
        )
    }
}