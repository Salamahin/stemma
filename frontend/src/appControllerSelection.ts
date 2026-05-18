import type { StemmaDescription } from "./model";

export function selectStemmaId(
    stemmas: StemmaDescription[],
    lastStemmaId?: string | null,
    defaultStemmaId?: string | null,
) {
    if (!stemmas || stemmas.length === 0) return null;
    if (lastStemmaId) {
        const match = stemmas.find((s) => s.id === lastStemmaId);
        if (match) return match.id;
    }
    if (defaultStemmaId) {
        const match = stemmas.find((s) => s.id === defaultStemmaId);
        if (match) return match.id;
    }
    return stemmas[0].id;
}
