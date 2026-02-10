import type { StemmaDescription } from "./model";

export function selectStemmaId(stemmas: StemmaDescription[], lastStemmaId?: string) {
    if (!stemmas || stemmas.length === 0) return null;
    if (lastStemmaId) {
        const match = stemmas.find((s) => s.id === lastStemmaId);
        if (match) return match.id;
    }
    return stemmas[0].id;
}
