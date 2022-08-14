import { StemmaIndex } from "./stemmaIndex";

export interface Highlight {
    personIsHighlighted(personId: number): boolean
    familyIsHighlighted(familyId: number): boolean
}

export class HighlightAll implements Highlight {
    personIsHighlighted(personId: number): boolean {
        return true
    }

    familyIsHighlighted(familyId: number): boolean {
        return true
    }
}

type LineageData = {
    from: number
    relatedPeople: Set<number>
    relatedFamilies: Set<number>
}

export class HiglightLineages implements Highlight {
    private lineagesData: LineageData[]
    private index: StemmaIndex

    private allPeople: Set<number>
    private allFamilies: Set<number>
    private allMariages: Set<number>
    private allUncleFamilies: Set<number>

    constructor(index: StemmaIndex, people: number[]) {
        this.index = index
        this.lineagesData = people.map(personId => this.personToLineageData(personId))

        this.remakeCashes()
    }

    private remakeCashes() {
        this.allPeople = new Set(this.lineagesData.map(d => d.relatedPeople).reduce((acc, next) => [...acc, ...next], []))
        this.allFamilies = new Set(this.lineagesData.map(d => d.relatedFamilies).reduce((acc, next) => [...acc, ...next], []))
        this.allMariages = new Set(this.index.marriages(this.allPeople))
        this.allUncleFamilies = new Set(this.index.uncleFamilies(this.allPeople))
    }

    private personToLineageData(personId) {
        let lineage = this.index.lineage(personId)
        return {
            from: personId,
            relatedPeople: lineage.relativies,
            relatedFamilies: lineage.families,
        }
    }

    private familyToLineageData(familyId) {
        let family = this.index.family(familyId)
        return {
            from: familyId,
            relatedPeople: new Set([...family.children, ...family.parents]),
            relatedFamilies: new Set([familyId])
        }
    }

    personIsHighlighted(personId: number): boolean {
        return !this.lineagesData.length || this.allPeople.has(personId)
    }

    familyIsHighlighted(familyId: number): boolean {
        return !this.lineagesData.length || this.allFamilies.has(familyId) || this.allMariages.has(familyId) || this.allUncleFamilies.has(familyId)
    }

    pushPerson(personId: number) {
        this.lineagesData.push(this.personToLineageData(personId))
        this.remakeCashes()
    }

    pushFamily(familyId: number) {
        this.lineagesData.push(this.familyToLineageData(familyId))
        this.remakeCashes()
    }

    pop() {
        this.lineagesData.pop()
        this.remakeCashes()
    }
}