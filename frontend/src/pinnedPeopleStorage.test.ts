import { PinnedPeopleStorage } from "./pinnedPeopleStorage";

describe("PinnedPeopleStorage", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("load initializes empty storage when none exists", () => {
        const storage = new PinnedPeopleStorage("stemma-1");
        storage.load();
        expect(storage.allPinned()).toEqual([]);
        expect(storage.isPinned("p1")).toBe(false);
    });

    test("add/remove persists pinned people", () => {
        const storage = new PinnedPeopleStorage("stemma-1");
        storage.load();
        storage.add("p1").add("p2");
        expect(storage.isPinned("p1")).toBe(true);
        storage.remove("p1");
        expect(storage.isPinned("p1")).toBe(false);

        const reloaded = new PinnedPeopleStorage("stemma-1");
        reloaded.load();
        expect(reloaded.allPinned().sort()).toEqual(["p2"]);
    });
});
