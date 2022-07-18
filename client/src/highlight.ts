import { StemmaIndex } from "./stemmaIndex";

export interface Highlight {
    personIsHighlighted(personId: string): boolean
    familyIsHighlighted(familyId: string): boolean
}

export class HighlightAll implements Highlight {
    personIsHighlighted(personId: string): boolean {
        return true
    }

    familyIsHighlighted(familyId: string): boolean {
        return true
    }
}

type LineageData = {
    marriages: string[]
    relatedPeople: Set<string>
    relatedFamilies: Set<string>
}

export class HiglightLineages implements Highlight {
    private lineagesData: LineageData[]
    private index: StemmaIndex

    private allPeople: Set<string>
    private allFamilies: Set<string>
    private allMariages: Set<string>

    constructor(index: StemmaIndex, people: string[]) {
        this.index = index
        this.lineagesData = people.map(personId => this.toLineageData(personId))

        this.remakeCashes()
    }

    private remakeCashes() {
        this.allPeople = new Set(this.lineagesData.map(d => d.relatedPeople).reduce((acc, next) => [...acc, ...next], []))
        this.allFamilies = new Set(this.lineagesData.map(d => d.relatedFamilies).reduce((acc, next) => [...acc, ...next], []))

        let allMarriagesCounted = this.count(this.lineagesData.flatMap(d => d.marriages))
        this.allMariages = new Set(Array.from(allMarriagesCounted.entries()).filter(x => x[1] > 1).map(x => x[0]))
    }

    private toLineageData(personId) {
        let lineage = this.index.lineage(personId)
        return {
            marriages: [...lineage.relativies].flatMap(pId => this.index.marriages(pId)),
            relatedPeople: lineage.relativies,
            relatedFamilies: lineage.families,
        }
    }

    private count<T>(array: Array<T>) {
        return array.reduce((acc, next) => {
            if (acc.has(next)) {
                acc.set(next, acc.get(next) + 1)
            } else {
                acc.set(next, 1)
            }
            return acc
        }, new Map<T, number>())
    }

    personIsHighlighted(personId: string): boolean {
        return !this.lineagesData.length || this.allPeople.has(personId)
    }

    familyIsHighlighted(familyId: string): boolean {
        return !this.lineagesData.length || this.allFamilies.has(familyId) || this.allMariages.has(familyId)
    }

    push(personId: string) {
        this.lineagesData.push(this.toLineageData(personId))
        this.remakeCashes()
    }

    pop() {
        this.lineagesData.pop()
        this.remakeCashes()
    }
}