
export class PinnedPeopleStorage {
    private stemmaId;
    private pinnedPeople: Set<string>

    constructor(stemmaId: string) {
        this.stemmaId = stemmaId
        this.pinnedPeople = new Set()
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

    add(personId: string) {
        console.log("add!", personId)
        this.pinnedPeople.add(personId)
        this.save()
        return this;
    }

    remove(personId: string) {
        console.log("remove!", personId)
        this.pinnedPeople.delete(personId)
        this.save()
        return this;
    }

    allPinned() {
        return [...this.pinnedPeople]
    }

    isPinned(personId: string) {
        return this.pinnedPeople.has(personId)
    }
}