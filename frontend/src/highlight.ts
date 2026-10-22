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

export class HighlightLineages implements Highlight {
    private lineagesData: LineageData[]
    private index: StemmaIndex

    private allPeople: Set<string>
    private allFamilies: Set<string>
    private allMarriages: Set<string>
    private allUncleFamilies: Set<string>

    constructor(index: StemmaIndex, people: string[]) {
        this.index = index
        this.lineagesData = people.map(personId => this.personToLineageData(personId))

        this.remakeCaches()
    }

    private remakeCaches() {
        this.allPeople = new Set(this.lineagesData.map(d => d.relatedPeople).reduce((acc, next) => [...acc, ...next], []))
        this.allFamilies = new Set(this.lineagesData.map(d => d.relatedFamilies).reduce((acc, next) => [...acc, ...next], []))
        this.allMarriages = new Set(this.index.marriages(this.allPeople))
        this.allUncleFamilies = new Set(this.index.uncleFamilies(this.allPeople))
    }

    private personToLineageData(personId: string) {
        let lineage = this.index.lineage(personId)
        if (!lineage) {
            return {
                from: personId,
                relatedPeople: new Set<string>([personId]),
                relatedFamilies: new Set<string>(),
            }
        }
        return {
            from: personId,
            relatedPeople: lineage.relativies,
            relatedFamilies: lineage.families,
        }
    }

    private familyToLineageData(familyId: string) {
        let family = this.index.family(familyId)
        if (!family) {
            return {
                from: familyId,
                relatedPeople: new Set<string>(),
                relatedFamilies: new Set<string>([familyId]),
            }
        }
        return {
            from: familyId,
            relatedPeople: new Set([...family.children, ...family.parents]),
            relatedFamilies: new Set([familyId])
        }
    }

    personIsHighlighted(personId: string): boolean {
        return !this.lineagesData.length || this.allPeople.has(personId)
    }

    familyIsHighlighted(familyId: string): boolean {
        return !this.lineagesData.length || this.allFamilies.has(familyId) || this.allMarriages.has(familyId) || this.allUncleFamilies.has(familyId)
    }

    isActive(): boolean {
        return this.lineagesData.length > 0
    }

    highlightedPeopleIds(): Set<string> {
        return this.allPeople
    }

    highlightedFamilyIds(): Set<string> {
        return new Set([...this.allFamilies, ...this.allMarriages, ...this.allUncleFamilies])
    }

    pushPerson(personId: string) {
        this.lineagesData.push(this.personToLineageData(personId))
        this.remakeCaches()
    }

    pushFamily(familyId: string) {
        this.lineagesData.push(this.familyToLineageData(familyId))
        this.remakeCaches()
    }

    pop() {
        this.lineagesData.pop()
        this.remakeCaches()
    }
}
/** Everyone born in the given age steps (ageSteps.ts), and every family one of them is a parent or child in. */
export class HighlightAgeStep implements Highlight {
    constructor(private index: StemmaIndex, readonly steps: ReadonlySet<number>) {}

    personIsHighlighted(personId: string): boolean {
        const step = this.index.ageStep(personId)
        return step != null && this.steps.has(step)
    }

    familyIsHighlighted(familyId: string): boolean {
        const f = this.index.family(familyId)
        if (!f) return false
        return [...(f.parents ?? []), ...(f.children ?? [])].some(p => this.personIsHighlighted(p))
    }
}

/** Shows what either shows. */
class HighlightEither implements Highlight {
    constructor(private a: Highlight, private b: Highlight) {}

    personIsHighlighted(personId: string): boolean {
        return this.a.personIsHighlighted(personId) || this.b.personIsHighlighted(personId)
    }

    familyIsHighlighted(familyId: string): boolean {
        return this.a.familyIsHighlighted(familyId) || this.b.familyIsHighlighted(familyId)
    }
}

/**
 * The chosen age steps and the pinned or hovered branches (lineages) together:
 * a branch is shown on top of the steps, not instead of them.
 */
export function effectiveHighlight(lineages: HighlightLineages, index: StemmaIndex, ageSteps: ReadonlySet<number>): Highlight {
    if (!ageSteps.size) return lineages
    const steps = new HighlightAgeStep(index, ageSteps)
    // With no branch, lineages "highlight everything": only the steps count then.
    return lineages.isActive() ? new HighlightEither(lineages, steps) : steps
}
