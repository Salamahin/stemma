import { StoredPerson } from "./model";
import { Generation, StemmaIndex } from "./stemmaIndex";

export interface SelectionController {
    personIsSelected(personId: string): boolean
    familyIsSelected(familyId: string): boolean
    connected(personId: string, familyId: string): boolean
}

class NoOpSelectionController implements SelectionController {
    personIsSelected(personId: string): boolean {
        return false
    }
    familyIsSelected(familyId: string): boolean {
        return false
    }
    connected(personId: string, familyId: string): boolean {
        return false
    }

}

abstract class SelectionControllerImpl implements SelectionController {
    abstract personIsSelected(personId: string): boolean

    abstract familyIsSelected(familyId: string): boolean

    connected(personId: string, familyId: string): boolean {
        return this.personIsSelected(personId) && this.familyIsSelected(familyId)
    }
}

function compose(left: SelectionController, right: SelectionController) {
    return new class extends SelectionControllerImpl {
        personIsSelected(personId: string): boolean {
            return left.personIsSelected(personId) || right.personIsSelected(personId)
        }

        familyIsSelected(familyId: string): boolean {
            return left.familyIsSelected(familyId) || right.familyIsSelected(familyId)
        }
    }
}

export function composeAllSelectionControllers(controllers: SelectionController[]) {
    return controllers.reduce((prev, current) => compose(prev, current), new NoOpSelectionController())
}

export class SimpleSelectionController extends SelectionControllerImpl {
    private peopleIds: Set<string>
    private familyIds: Set<string>

    constructor(peopleIdsToSelect: string[], familyIdsToSelect: string[]) {
        super()
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

export class LineageSelectionController extends SelectionControllerImpl {
    private generation: Generation

    constructor(index: StemmaIndex, personId: string) {
        super()
        this.generation = index.lineage(personId)
    }

    personIsSelected(personId: string): boolean {
        return this.generation.relativies.has(personId)
    }

    familyIsSelected(familyId: string): boolean {
        return this.generation.families.has(familyId)
    }
}