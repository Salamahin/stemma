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
        this.allMariages = new Set(this.index.marriages(this.allPeople))
    }

    private toLineageData(personId) {
        let lineage = this.index.lineage(personId)
        return {
            relatedPeople: lineage.relativies,
            relatedFamilies: lineage.families,
        }
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