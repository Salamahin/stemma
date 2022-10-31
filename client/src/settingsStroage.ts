import { DEFAULT_SETTINGS, Settings } from "./model";

export class SettingsStorage {
    private stemmaId: string;
    private settings: Settings

    constructor(stemmaId: string) {
        this.stemmaId = stemmaId;
    }

    load() {
        let settingsStr = localStorage.getItem(`settings-${this.stemmaId}`)
        this.settings = settingsStr ? JSON.parse(settingsStr) as Settings : DEFAULT_SETTINGS
    }

    store(settings: Settings) {
        this.settings = settings
        localStorage.setItem(`settings-${this.stemmaId}`, JSON.stringify(this.settings))
    }

    get() {
        return this.settings;
    }
}