import { Family, Stemma, StoredPerson } from "./model";

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
    private _parentToChildren: Map<string, FamilyDescription[]>
    private _childToParents: Map<string, FamilyDescription[]>
    private _people: Map<string, StoredPerson>
    private _namesakes: Map<string, string[]>
    private _lineage: Map<string, Generation>
    private _maxGeneration: number
    private _families: Map<string, Family[]>

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
        this._parentToChildren = new Map(this.groupByKey(stemma.families.flatMap((f) => {
            if (f.children.length) return f.parents.map((p) => [p, ({ familyId: f.id, members: f.children })])
            else return []
        })))

        this._childToParents = new Map(this.groupByKey(stemma.families.flatMap((f) => {
            if (f.parents.length) return f.children.map((p) => [p, ({ familyId: f.id, members: f.parents })])
            else return []
        })))

        this._namesakes = new Map(this.groupByKey(stemma.people.map(p => [p.name, p.id])))
        this._people = new Map(stemma.people.map(p => [p.id, p]))
        this._lineage = new Map<string, Generation>(
            stemma.people.map(p => [p.id, this.buildLineage(p)])
        )
        this._maxGeneration = Math.max(...[...this._lineage.values()].map(p => p.generation));
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

    private buildLineage(p: StoredPerson): Generation {
        let dependees = this.computeLineage(p.id, this._parentToChildren)
        let ancestors = this.computeLineage(p.id, this._childToParents)

        let generation = ancestors.depth

        return {
            generation: generation,
            relativies: new Set([...ancestors.relativies, ...dependees.relativies]),
            families: new Set([...ancestors.families, ...dependees.families])
        }
    }

    lineage(personId: string): Generation {
        return this._lineage.has(personId) ? this._lineage.get(personId) : { generation: 0, relativies: new Set(), families: new Set() }
    }

    relativies(personId: string) {
        let ps = this._parentToChildren.has(personId) ? this._parentToChildren.get(personId).flatMap(x => x.members).map(p => this._people.get(p)) : []
        let cs = this._childToParents.has(personId) ? this._childToParents.get(personId).flatMap(x => x.members).map(p => this._people.get(p)) : []

        return [...ps, ...cs, this._people.get(personId)]
    }

    relatedFamilies(personId: string) {
        let directChildren = this._parentToChildren.has(personId) ? this._parentToChildren.get(personId) : []
        let directParents = this._childToParents.has(personId) ? this._childToParents.get(personId) : []

        return [
            ...directChildren.map(f => ({ id: f.familyId, parents: [personId], children: f.members })),
            ...directParents.map(f => ({ id: f.familyId, parents: f.members, children: [personId] }))
        ]
    }

    namesakes(personName: string) {
        return this._namesakes.has(personName) ? this._namesakes.get(personName).map(p => this._people.get(p)) : []
    }

    get(personId: string) {
        return this._people.get(personId)
    }

    maxGeneration() {
        return this._maxGeneration
    }
}