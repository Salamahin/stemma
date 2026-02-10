import { SettingsStorage } from "./settingsStroage";
import { DEFAULT_SETTINGS, ViewMode } from "./model";

describe("SettingsStorage", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("load uses defaults when empty", () => {
        const storage = new SettingsStorage("stemma-1");
        storage.load();
        expect(storage.get()).toEqual(DEFAULT_SETTINGS);
    });

    test("store persists settings", () => {
        const storage = new SettingsStorage("stemma-1");
        const next = { viewMode: ViewMode.EDITABLE_ONLY };
        storage.store(next);

        const reloaded = new SettingsStorage("stemma-1");
        reloaded.load();
        expect(reloaded.get()).toEqual(next);
    });
});
