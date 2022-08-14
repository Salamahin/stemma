import { Stemma, FamilyDescription, PersonDescription } from "./model";

export type Generation = {
    generation: number,
    relativies: Set<number>
    families: Set<number>
};

type DirectedFamilyDescription = {
    familyId: number,
    members: number[],
    otherMembers: number[]
}

type PersonalGeneration = {
    personId: number,
    depth: number
}

type FamilyMembers = {
    familyId: number
    members: number[]
}


export class StemmaIndex {
    private _parentToChildren: Map<number, DirectedFamilyDescription[]>
    private _childToParents: Map<number, DirectedFamilyDescription[]>
    private _marriages: FamilyMembers[]
    private _uncles: FamilyMembers[]
    private _families: Map<number, FamilyDescription>

    private _people: Map<number, PersonDescription>
    private _namesakes: Map<string, number[]>
    private _lineage: Map<number, Generation>
    private _maxGeneration: number

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
            if (f.children) return f.parents.map((p) => [p, ({ familyId: f.id, members: f.children, otherMembers: f.parents })])
            else return []
        })))

        this._childToParents = new Map(this.groupByKey(stemma.families.flatMap((f) => {
            if (f.parents) return f.children.map((p) => [p, ({ familyId: f.id, members: f.parents, otherMembers: f.children })])
            else return []
        })))

        this._families = new Map(stemma.families.map(f => [f.id, f]))

        this._marriages = stemma.families.map(f => ({ familyId: f.id, members: f.parents }))
        this._uncles = stemma.families.map(f => ({ familyId: f.id, members: f.children }))

        this._namesakes = new Map(this.groupByKey(stemma.people.map(p => [p.name, p.id])))
        this._people = new Map(stemma.people.map(p => [p.id, p]))
        this._lineage = new Map(stemma.people.map(p => [p.id, this.buildLineage(p)]))
        this._maxGeneration = Math.max(...[...this._lineage.values()].map(p => p.generation));
    }

    private computeLineage(personId: number, relation: Map<number, DirectedFamilyDescription[]>) {
        var foundRelatieves: number[] = []
        var foundFamilies: number[] = []
        var toLookUp = [{ personId: personId, depth: 0 }]
        var maxDepth = 0

        while (toLookUp.length) {
            let [head, ...tail] = toLookUp
            var nextGen: PersonalGeneration[] = []

            if (relation.has(head.personId)) {
                let nextDepth = head.depth + 1
                let descr = relation.get(head.personId)

                maxDepth = Math.max(maxDepth, nextDepth)
                nextGen = descr.flatMap(x => x.members).map(personId => ({ personId: personId, depth: nextDepth }))
                foundFamilies = [...descr.filter(f => f.members.length).map(x => x.familyId), ...foundFamilies]
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

    private buildLineage(p: PersonDescription): Generation {
        let dependees = this.computeLineage(p.id, this._parentToChildren)
        let ancestors = this.computeLineage(p.id, this._childToParents)

        let generation = ancestors.depth

        return {
            generation: generation,
            relativies: new Set([...ancestors.relativies, ...dependees.relativies]),
            families: new Set([...ancestors.families, ...dependees.families])
        }
    }

    lineage(personId: number): Generation {
        return this._lineage.has(personId) ? this._lineage.get(personId) : { generation: 0, relativies: new Set(), families: new Set() }
    }

    family(familyId: number) {
        return this._families.get(familyId)
    }

    relativies(personId: number) {
        let ps = this._parentToChildren.has(personId)
            ? this._parentToChildren.get(personId).flatMap(x => [...x.members, ...x.otherMembers]).map(p => this._people.get(p))
            : []

        let cs = this._childToParents.has(personId)
            ? this._childToParents.get(personId).flatMap(x => [...x.members, ...x.otherMembers]).map(p => this._people.get(p))
            : []

        return [...new Set([...ps, ...cs, this._people.get(personId)])]
    }

    relatedFamilies(personId: number) {
        let dc = this._parentToChildren.has(personId) ? this._parentToChildren.get(personId) : []
        let dp = this._childToParents.has(personId) ? this._childToParents.get(personId) : []

        return [
            ...dc.filter(f => f.members.length + f.otherMembers.length).map(f => ({ id: f.familyId, parents: f.otherMembers, children: f.members })),
            ...dp.filter(f => f.members.length + f.otherMembers.length).map(f => ({ id: f.familyId, parents: f.members, children: f.otherMembers }))
        ]
    }

    private hasAllMembers(members: number[], pool: Set<number>) {
        return members.length != 0 && members.filter(m => pool.has(m)).length == members.length
    }

    private has2Members(members: number[], pool: Set<number>) {
        return members.length != 0 && members.filter(m => pool.has(m)).length > 1
    }

    marriages(peopleIds: Set<number>) {
        return this._marriages.filter(fd => fd.members.length > 1 && this.hasAllMembers(fd.members, peopleIds)).map(fd => fd.familyId)
    }

    uncleFamilies(peopleIds: Set<number>) {
        return this._uncles.filter(fd => this.has2Members(fd.members, peopleIds)).map(fd => fd.familyId)
    }

    namesakes(personName: string) {
        return this._namesakes.has(personName) ? this._namesakes.get(personName).map(p => this._people.get(p)) : []
    }

    person(personId: number) {
        return this._people.get(personId)
    }

    maxGeneration() {
        return this._maxGeneration
    }
}