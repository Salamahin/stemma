
export class PinnedPeopleStorage {
    private stemmaId;
    private pinnedPeople: Set<string>

    constructor(stemmaId: string) {
        this.stemmaId = stemmaId
        this.pinnedPeople = new Set()
    }

    load() {
        let value = localStorage.getItem(this.stemmaId)
        this.pinnedPeople = new Set(...JSON.parse(value).items)
    }

    save() {
        let value = JSON.stringify({
            items: [...this.pinnedPeople]
        })
        localStorage.setItem(this.stemmaId, value)
    }

    add(personId: string) {
        this.pinnedPeople.add(personId)
        this.save()
    }

    remove(personId: string) {
        this.pinnedPeople.delete(personId)
        this.save()
    }

    allPinned() {
        return [...this.pinnedPeople]
    }

    isPinned(personId: string) {
        return this.pinnedPeople.has(personId)
    }

}