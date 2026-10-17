/** How an unknown person (or an unknown part of a name) is shown, in every language. */
export const UNKNOWN_PERSON = "???";

// Placeholders people type (or imports write) instead of a real name. They are
// normalised on display, so stored names need no migration.
const PLACEHOLDER_NAMES = new Set(["unknown", "неизвестно", "неизвестный", "неизвестная", "имя неизвестно", "(имя неизвестно)"]);
const PLACEHOLDER_WORD = /^(\?+|unknown|неизвестно|неизвестный|неизвестная)$/i;

export function isUnknownPerson(name: string | null | undefined): boolean {
    const trimmed = (name ?? "").trim();
    if (trimmed === "") return true;
    if (/^\?+$/.test(trimmed)) return true;
    return PLACEHOLDER_NAMES.has(trimmed.toLowerCase());
}

export function personDisplayName(name: string | null | undefined): string {
    if (isUnknownPerson(name)) return UNKNOWN_PERSON;
    return name!
        .trim()
        .split(/\s+/)
        .map((word) => (PLACEHOLDER_WORD.test(word) ? UNKNOWN_PERSON : word))
        .join(" ");
}
