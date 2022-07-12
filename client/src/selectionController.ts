import { StoredPerson } from "./model";
import { Generation, StemmaIndex } from "./stemmaIndex";

export interface SelectionController {
    personIsSelected(personId: string): boolean
    familyIsSelected(familyId: string): boolean
}

class SelectNothingController implements SelectionController {
    personIsSelected(personId: string): boolean {
        return false
    }
    familyIsSelected(familyId: string): boolean {
        return false
    }
}

export class SelectEverythingController implements SelectionController {
    personIsSelected(personId: string): boolean {
        return true
    }
    familyIsSelected(familyId: string): boolean {
        return true
    }
}

function compose(left: SelectionController, right: SelectionController) {
    return new class implements SelectionController {
        personIsSelected(personId: string): boolean {
            return left.personIsSelected(personId) || right.personIsSelected(personId)
        }

        familyIsSelected(familyId: string): boolean {
            return left.familyIsSelected(familyId) || right.familyIsSelected(familyId)
        }
    }
}

export function composeAllSelectionControllers(controllers: SelectionController[]) {
    return controllers.reduce((prev, current) => compose(prev, current), new SelectNothingController())
}

export class SimpleSelectionController implements SelectionController {
    private peopleIds: Set<string>
    private familyIds: Set<string>

    constructor(peopleIdsToSelect: string[], familyIdsToSelect: string[]) {
        this.peopleIds = new Set(peopleIdsToSelect)
        this.familyIds = new Set(familyIdsToSelect)
    }

    personIsSelected(personId: string) {
        return this.peopleIds.has(personId)
    }

    familyIsSelected(familyId: string) {
        return this.familyIds.has(familyId)
    }
}

export class LineageSelectionController implements SelectionController {
    private generation: Generation

    constructor(index: StemmaIndex, personId: string) {
        this.generation = index.lineage(personId)
    }

    personIsSelected(personId: string): boolean {
        return this.generation.relativies.has(personId)
    }

    familyIsSelected(familyId: string): boolean {
        return this.generation.families.has(familyId)
    }
}

export class StackedSelectionController implements SelectionController {
    private underlying: SelectionController[]

    constructor(initial: SelectionController) {
        this.underlying = [initial]
    }

    push(contoller: SelectionController) {
        this.underlying = [contoller, ...this.underlying]
        console.log(this.underlying)
    }

    pop() {
        this.underlying = this.underlying.slice(1, this.underlying.length)
        console.log(this.underlying)
    }

    personIsSelected(personId: string): boolean {
        let head = this.underlying[0]
        return head.personIsSelected(personId)
    }

    familyIsSelected(familyId: string): boolean {
        let head = this.underlying[0]
        return head.familyIsSelected(familyId)
    }

}