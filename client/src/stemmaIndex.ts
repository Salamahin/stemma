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


export class StemmaIndex {
    private stemma: Stemma
    private parentToChildren: Map<string, FamilyDescription[]>
    private childToParents: Map<string, FamilyDescription[]>
    private _names: Map<string, string>
    private _people: Map<string, StoredPerson>
    private _namesakes: Map<string, string[]>

    private groupByKey<K, V>(array: Array<readonly [K, V]>) {
        return array.reduce((store, item) => {
            var key = item[0]
            if (!store.has(key)) {
                store.set(key, [item[1]])
            } else {
                store.get(key).push(item[1])
            }
            return store
        }, new Map<K, V[]>())
    }

    constructor(stemma: Stemma) {
        this.stemma = stemma

        this.parentToChildren = new Map(this.groupByKey(stemma.families.flatMap((f) => {
            if (f.children.length) return f.parents.map((p) => [p, ({ familyId: f.id, members: f.children })])
            else return []
        })))

        this.childToParents = new Map(this.groupByKey(stemma.families.flatMap((f) => {
            if (f.parents.length) return f.children.map((p) => [p, ({ familyId: f.id, members: f.parents })])
            else return []
        })))

        this._names = new Map(stemma.people.map(p => [p.id, p.name]))
        this._namesakes = new Map(this.groupByKey(stemma.people.map(p => [p.name, p.id])))
        this._people = new Map(stemma.people.map(p => [p.id, p]))
    }

    private computeLineage(personId: string, relation: Map<string, FamilyDescription[]>) {
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
                nextGen = descr.flatMap(x => x.members).map(personId => ({ personId: personId, depth: nextDepth }))
                foundFamilies = [...descr.map(x => x.familyId), ...foundFamilies]
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

    parents(child: string) {
        return this.childToParents.get(child).flatMap(x => x.members)
    }

    children(child: string) {
        return this.parentToChildren.get(child).flatMap(x => x.members)
    }

    name(p: string) {
        return this._names.get(p)
    }

    namesakes(p: string) {
        return this._namesakes.has(p) ? this._namesakes.get(p) : []
    }

    get(p: string) {
        return this._people.get(p)
    }
}