
export class PinnedPeopleStorage {
    private stemmaId;
    private pinnedPeople: Set<number>

    constructor(stemmaId: number) {
        this.stemmaId = `pinned.${stemmaId}`
    }

    load() {
        let value = localStorage.getItem(this.stemmaId)
        if (value) this.pinnedPeople = new Set(JSON.parse(value).items)
        else this.pinnedPeople = new Set()
    }

    private save() {
        let value = JSON.stringify({
            items: [...this.pinnedPeople]
        })
        localStorage.setItem(this.stemmaId, value)
    }

    add(personId: number) {
        this.pinnedPeople.add(personId)
        this.save()
        return this;
    }

    remove(personId: number) {
        this.pinnedPeople.delete(personId)
        this.save()
        return this;
    }

    allPinned() {
        return [...this.pinnedPeople]
    }

    isPinned(personId: number) {
        return this.pinnedPeople.has(personId)
    }
}