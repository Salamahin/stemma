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
    borderFamilies: Set<string>
    relatedPeople: Set<string>
    relatedFamilies: Set<string>
}

export class HiglightLineages implements Highlight {
    private lineagesData: LineageData[]
    private index: StemmaIndex

    private allPeople: Set<string>
    private allFamilies: Set<string>
    private borderFamilies: Set<string>

    constructor(index: StemmaIndex, people: string[]) {
        this.index = index
        this.lineagesData = people.map(personId => this.toLineageData(personId))

        this.remakeCashes()
    }

    private remakeCashes() {
        this.allPeople = new Set(this.lineagesData.map(d => d.relatedPeople).reduce((acc, next) => [...acc, ...next], []))
        this.allFamilies = new Set(this.lineagesData.map(d => d.relatedFamilies).reduce((acc, next) => [...acc, ...next], []))

        let [bfHead, ...bfTail] = this.lineagesData.map(d => d.borderFamilies)
        this.borderFamilies = bfTail.reduce((acc, next) => new Set([...acc].filter(element => next.has(element))), bfHead)
    }

    private toLineageData(personId) {
        let relativies = this.index.relativies(personId).map(p => p.id)
        return {
            borderFamilies: new Set(relativies.flatMap(pId => this.index.marriages(pId))),
            relatedPeople: new Set(relativies),
            relatedFamilies: new Set(this.index.relatedFamilies(personId).map(f => f.id)),
        }
    }

    personIsHighlighted(personId: string): boolean {
        return !this.lineagesData.length || this.allPeople.has(personId)
    }

    familyIsHighlighted(familyId: string): boolean {
        return !this.lineagesData.length || this.allFamilies.has(familyId) || (this.lineagesData.length > 1 && this.borderFamilies.has(familyId))
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