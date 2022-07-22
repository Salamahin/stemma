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
    from: string
    relatedPeople: Set<string>
    relatedFamilies: Set<string>
}

export class HiglightLineages implements Highlight {
    private lineagesData: LineageData[]
    private index: StemmaIndex

    private allPeople: Set<string>
    private allFamilies: Set<string>
    private allMariages: Set<string>
    private allUncleFamilies: Set<string>

    constructor(index: StemmaIndex, people: string[]) {
        this.index = index
        this.lineagesData = people.map(personId => this.personToLineageData(personId))

        this.remakeCashes()
    }

    private remakeCashes() {
        this.allPeople = new Set(this.lineagesData.map(d => d.relatedPeople).reduce((acc, next) => [...acc, ...next], []))
        this.allFamilies = new Set(this.lineagesData.map(d => d.relatedFamilies).reduce((acc, next) => [...acc, ...next], []))
        this.allMariages = new Set(this.index.marriages(this.allPeople))
        this.allUncleFamilies = new Set(this.index.uncleFamilies(this.allPeople))
        console.log(this.allUncleFamilies)
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
            relatedFamilies: new Set<string>([familyId])
        }
    }

    personIsHighlighted(personId: string): boolean {
        return !this.lineagesData.length || this.allPeople.has(personId)
    }

    familyIsHighlighted(familyId: string): boolean {
        return !this.lineagesData.length || this.allFamilies.has(familyId) || this.allMariages.has(familyId) || this.allUncleFamilies.has(familyId)
    }

    pushPerson(personId: string) {
        this.lineagesData.push(this.personToLineageData(personId))
        this.remakeCashes()
    }

    pushFamily(familyId: string) {
        this.lineagesData.push(this.familyToLineageData(familyId))
        this.remakeCashes()
    }

    pop() {
        this.lineagesData.pop()
        this.remakeCashes()
    }
}