import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";
import type { PersonDescription } from "./model";
import { hasCyrillic, toLatinVariants } from "./transliteration";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 8;
const FUSE_THRESHOLD = 0.4;

export function normalizeRu(value: string): string {
    return value
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/й/g, "и");
}

function searchVariants(value: string): string[] {
    const variants = new Set<string>();
    if (hasCyrillic(value)) variants.add(normalizeRu(value));
    for (const v of toLatinVariants(value)) variants.add(v);
    return [...variants];
}

export type PersonSearchMatch = readonly [number, number];

export type PersonSearchResult = {
    item: PersonDescription;
    matchedIndices: ReadonlyArray<PersonSearchMatch>;
};

const FUSE_OPTIONS: IFuseOptions<PersonDescription> = {
    keys: [{ name: "name", getFn: (person) => searchVariants(person.name) }],
    threshold: FUSE_THRESHOLD,
    ignoreLocation: true,
    minMatchCharLength: MIN_QUERY_LENGTH,
    includeScore: true,
};

const HIGHLIGHT_OPTIONS: IFuseOptions<string> = {
    includeMatches: true,
    threshold: FUSE_THRESHOLD,
    ignoreLocation: true,
    minMatchCharLength: 1,
};

export function searchPeople(
    query: string,
    people: ReadonlyArray<PersonDescription>,
    limit: number = DEFAULT_LIMIT,
): PersonSearchResult[] {
    if (query.length < MIN_QUERY_LENGTH) return [];
    const fuse = new Fuse(people as PersonDescription[], FUSE_OPTIONS);
    const scored = new Map<string, FuseResult<PersonDescription>>();
    for (const variant of searchVariants(query)) {
        for (const result of fuse.search(variant, { limit })) {
            const prior = scored.get(result.item.id);
            if (!prior || (result.score ?? 1) < (prior.score ?? 1)) {
                scored.set(result.item.id, result);
            }
        }
    }
    return [...scored.values()]
        .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
        .slice(0, limit)
        .map((r) => ({
            item: r.item,
            matchedIndices: computeHighlight(r.item.name, query),
        }));
}

function computeHighlight(
    name: string,
    query: string,
): ReadonlyArray<PersonSearchMatch> {
    if (hasCyrillic(name) !== hasCyrillic(query)) return [];
    const normalizedName = normalizeRu(name);
    const normalizedQuery = normalizeRu(query);
    const fuse = new Fuse([normalizedName], HIGHLIGHT_OPTIONS);
    return fuse.search(normalizedQuery)[0]?.matches?.[0]?.indices ?? [];
}

export function highlightMatches(
    name: string,
    indices: ReadonlyArray<PersonSearchMatch>,
): string {
    if (indices.length === 0) return escapeHtml(name);
    const sorted = [...indices].sort((a, b) => a[0] - b[0]);
    let out = "";
    let cursor = 0;
    for (const [start, end] of sorted) {
        if (start < cursor) continue;
        if (start > cursor) out += escapeHtml(name.slice(cursor, start));
        out += "<b>" + escapeHtml(name.slice(start, end + 1)) + "</b>";
        cursor = end + 1;
    }
    if (cursor < name.length) out += escapeHtml(name.slice(cursor));
    return out;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
