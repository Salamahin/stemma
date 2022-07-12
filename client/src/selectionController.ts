import { throws } from "assert";
import { StoredPerson } from "./model";
import { Generation, StemmaIndex } from "./stemmaIndex";

export interface Selection {
    personIsHighlighted(personId: string): boolean
    familyIsHighlighted(familyId: string): boolean
    personIsInteractive(personId: string): boolean
}

export interface SelectionController extends Selection {
    add(key: string, otherController: Selection): SelectionController
    remove(key: string): SelectionController
}

export class ComposableSelectionController implements SelectionController {
    private controllers: Map<string, Selection>

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

    personIsInteractive(personId: string): boolean {
        if (!this.controllers.size) return true;
        return [...this.controllers.values()].reduce((acc, next) => acc || next.personIsInteractive(personId), false)
    }

    add(key: string, otherController: SelectionController): SelectionController {
        this.controllers.set(key, otherController)
        return this
    }

    remove(key: string): SelectionController {
        this.controllers.delete(key)
        return this
    }
}

export class RestrictiveSelectionController implements SelectionController {
    private peopleIdsToHightlight: Set<string>
    private familyIdsToHightlight: Set<string>
    private peopleIdsToInteract: Set<string>

    constructor(peopleIdsToHighlight: string[], familyIdsToHighlight: string[], peopleIdsToInteract: string[]) {
        this.peopleIdsToHightlight = new Set(peopleIdsToHighlight)
        this.familyIdsToHightlight = new Set(familyIdsToHighlight)
        this.peopleIdsToInteract = new Set(peopleIdsToInteract)
    }

    personIsInteractive(personId: string): boolean {
        return this.peopleIdsToInteract.has(personId);
    }

    add(key: string, otherController: SelectionController): SelectionController {
        return this;
    }

    remove(key: string): SelectionController {
        return this;
    }

    personIsHighlighted(personId: string) {
        return this.peopleIdsToHightlight.has(personId)
    }

    familyIsHighlighted(familyId: string) {
        return this.familyIdsToHightlight.has(familyId)
    }
}

export class GenerationSelection implements Selection {
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

    personIsInteractive(personId: string): boolean {
        return this.generation.relativies.has(personId)
    }
}