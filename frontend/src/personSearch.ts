import Fuse, { type IFuseOptions } from "fuse.js";
import type { PersonDescription } from "./model";

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 8;

export function normalizeRu(value: string): string {
    return value
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/й/g, "и");
}

export type PersonSearchMatch = readonly [number, number];

export type PersonSearchResult = {
    item: PersonDescription;
    matchedIndices: ReadonlyArray<PersonSearchMatch>;
};

const FUSE_OPTIONS: IFuseOptions<PersonDescription> = {
    keys: [{ name: "name", getFn: (person) => normalizeRu(person.name) }],
    includeMatches: true,
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: MIN_QUERY_LENGTH,
};

export function searchPeople(
    query: string,
    people: ReadonlyArray<PersonDescription>,
    limit: number = DEFAULT_LIMIT,
): PersonSearchResult[] {
    if (query.length < MIN_QUERY_LENGTH) return [];
    const fuse = new Fuse(people as PersonDescription[], FUSE_OPTIONS);
    return fuse.search(normalizeRu(query), { limit }).map((result) => ({
        item: result.item,
        matchedIndices: result.matches?.[0]?.indices ?? [],
    }));
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
