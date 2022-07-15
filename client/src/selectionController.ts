import { throws } from "assert";
import { StoredPerson } from "./model";
import { Generation, StemmaIndex } from "./stemmaIndex";

export interface Highlight {
    personIsHighlighted(personId: string): boolean
    familyIsHighlighted(familyId: string): boolean
}

export interface SelectionController extends Highlight {
    add(key: string, otherController: Highlight)
    remove(key: string)
}

export class HighlightAll implements Highlight {
    personIsHighlighted(personId: string): boolean {
        return true
    }

    familyIsHighlighted(familyId: string): boolean {
        return true
    }

}

export class ComposableSelectionController implements SelectionController {
    private controllers: Map<string, Highlight>

    constructor() {
        this.controllers = new Map()
    }

    personIsHighlighted(personId: string): boolean {
        if (!this.controllers.size) return true;
        return [...this.controllers.values()].reduce((acc, next) => acc || next.personIsHighlighted(personId), false)
    }

    familyIsHighlighted(familyId: string): boolean {
        if (!this.controllers.size) return true;
        return [...this.controllers.values()].reduce((acc, next) => acc || next.familyIsHighlighted(familyId), false)
    }

    add(key: string, otherController: SelectionController) {
        this.controllers.set(key, otherController)
    }

    remove(key: string) {
        this.controllers.delete(key)
    }
}

export class RestrictiveSelectionController implements SelectionController {
    private peopleIdsToHightlight: Set<string>

    constructor(peopleIdsToHighlight: string[]) {
        this.peopleIdsToHightlight = new Set(peopleIdsToHighlight)
    }

    add(key: string, otherController: SelectionController) {
    }

    remove(key: string) {
    }

    personIsHighlighted(personId: string) {
        return this.peopleIdsToHightlight.has(personId)
    }

    familyIsHighlighted(familyId: string) {
        return false
    }
}

export class GenerationSelection implements Highlight {
    private generation: Generation

    constructor(index: StemmaIndex, personId: string) {
        this.generation = index.lineage(personId)
    }

    personIsHighlighted(personId: string): boolean {
        return this.generation.relativies.has(personId)
    }

    familyIsHighlighted(familyId: string): boolean {
        return this.generation.families.has(familyId)
    }
}