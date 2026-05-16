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
        expect(storage.getPosition("p1")).toBeNull();
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

    test("updatePosition stores coordinates and survives reload", () => {
        const storage = new PinnedPeopleStorage("stemma-1");
        storage.load();
        storage.add("p1");
        storage.updatePosition("p1", 12.5, -7.25);

        expect(storage.getPosition("p1")).toEqual([12.5, -7.25]);

        const reloaded = new PinnedPeopleStorage("stemma-1");
        reloaded.load();
        expect(reloaded.isPinned("p1")).toBe(true);
        expect(reloaded.getPosition("p1")).toEqual([12.5, -7.25]);
    });

    test("updatePosition on an unpinned person is a no-op", () => {
        const storage = new PinnedPeopleStorage("stemma-1");
        storage.load();
        storage.updatePosition("ghost", 1, 2);
        expect(storage.isPinned("ghost")).toBe(false);
        expect(storage.getPosition("ghost")).toBeNull();
    });

    test("remove clears the persisted position", () => {
        const storage = new PinnedPeopleStorage("stemma-1");
        storage.load();
        storage.add("p1");
        storage.updatePosition("p1", 10, 20);
        storage.remove("p1");
        storage.add("p1");

        expect(storage.getPosition("p1")).toBeNull();
    });

    test("add does not overwrite an existing position", () => {
        const storage = new PinnedPeopleStorage("stemma-1");
        storage.load();
        storage.add("p1");
        storage.updatePosition("p1", 3, 4);
        storage.add("p1");
        expect(storage.getPosition("p1")).toEqual([3, 4]);
    });

    test("loads legacy {items:[string]} format", () => {
        localStorage.setItem("pinned.stemma-1", JSON.stringify({ items: ["legacy1", "legacy2"] }));

        const storage = new PinnedPeopleStorage("stemma-1");
        storage.load();
        expect(storage.allPinned().sort()).toEqual(["legacy1", "legacy2"]);
        expect(storage.getPosition("legacy1")).toBeNull();
    });

    test("ignores corrupted localStorage payload", () => {
        localStorage.setItem("pinned.stemma-1", "not-json");
        const storage = new PinnedPeopleStorage("stemma-1");
        storage.load();
        expect(storage.allPinned()).toEqual([]);
    });
});
