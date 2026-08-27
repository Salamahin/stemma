import type { StemmaDescription } from "./model";

export function selectStemmaId(
    stemmas: StemmaDescription[],
    lastStemmaId?: string | null,
    defaultStemmaId?: string | null,
    favouriteStemmaId?: string | null,
) {
    if (!stemmas || stemmas.length === 0) return null;
    // An explicit favourite outranks the last visited stemma; the seeded default only
    // kicks in when the user has never opened anything.
    for (const candidate of [favouriteStemmaId, lastStemmaId, defaultStemmaId]) {
        if (!candidate) continue;
        const match = stemmas.find((s) => s.id === candidate);
        if (match) return match.id;
    }
    return stemmas[0].id;
}
