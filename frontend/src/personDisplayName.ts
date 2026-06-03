import type { TranslationFn } from "./i18n";

export function isUnknownPerson(name: string | null | undefined): boolean {
    return !name || name.trim() === "";
}

export function personDisplayName(name: string | null | undefined, t: TranslationFn): string {
    if (!name || name.trim() === "") return t("person.unknown");
    return name;
}
