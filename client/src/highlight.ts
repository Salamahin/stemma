import { throws } from "assert";
import { StoredPerson } from "./model";
import { Generation, StemmaIndex } from "./stemmaIndex";

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

export class CompositeHighlight implements Highlight {
    private stack: Highlight[]

    constructor(init: Highlight[]) {
        this.stack = [...init]
    }

    personIsHighlighted(personId: string): boolean {
        if (!this.stack.length) return true;
        return this.stack.reduce((acc, next) => acc || next.personIsHighlighted(personId), false)
    }

    familyIsHighlighted(familyId: string): boolean {
        if (!this.stack.length) return true;
        return [...this.stack.values()].reduce((acc, next) => acc || next.familyIsHighlighted(familyId), false)
    }

    push(other: Highlight) {
        this.stack.push(other)
        return this;
    }

    pop() {
        this.stack.pop()
        return this;
    }
}


export class HighlightLineage implements Highlight {
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