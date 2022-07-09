import { Stemma } from "./model";

export class StemmaFilter {
    private highligtedNodes

    constructor(stemmaId: string) {
        this.highligtedPeople = window.localStorage.getItem(stemmaId)
    }

    highlight(id: string) 
}