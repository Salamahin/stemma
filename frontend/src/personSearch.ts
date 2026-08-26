import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";
import type { PersonDescription } from "./model";
import { hasCyrillic, toLatinVariants } from "./transliteration";
import { isUnknownPerson } from "./personDisplayName";

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

const NON_WORD = /[^\p{L}\p{N}]+/u;

/** Split a name or query into word tokens, dropping punctuation ("(Романова)" → "Романова"). */
function tokenize(value: string): string[] {
    return value.split(NON_WORD).filter(Boolean);
}

function tokenVariants(value: string): string[] {
    return [...new Set(tokenize(value).flatMap(searchVariants))];
}

export type PersonSearchMatch = readonly [number, number];

export type PersonSearchResult = {
    item: PersonDescription;
    matchedIndices: ReadonlyArray<PersonSearchMatch>;
};

const FUSE_OPTIONS: IFuseOptions<PersonDescription> = {
    keys: [{ name: "name", getFn: (person) => tokenVariants(person.name) }],
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
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];
    const searchable = people.filter((p) => !isUnknownPerson(p.name));
    const fuse = new Fuse(searchable as PersonDescription[], FUSE_OPTIONS);
    const nameVariants = new Map(searchable.map((p) => [p.id, tokenVariants(p.name)]));

    // Score each query token on its own and keep only people every token matched: word
    // order stops mattering, and one unmatched word rules a person out instead of merely
    // worsening the score of a name that matched the rest.
    let totals: Map<string, number> | null = null;
    for (const token of queryTokens) {
        const scores = scoreToken(token, searchable, nameVariants, fuse);
        const merged = new Map<string, number>();
        for (const [id, score] of scores) {
            const prior = totals?.get(id) ?? 0;
            if (totals === null || totals.has(id)) merged.set(id, prior + score);
        }
        totals = merged;
        if (totals.size === 0) return [];
    }

    const byId = new Map(searchable.map((p) => [p.id, p]));
    return [...(totals ?? new Map<string, number>())]
        .sort((a, b) => a[1] - b[1])
        .slice(0, limit)
        .flatMap(([id]) => {
            const item = byId.get(id);
            return item ? [{ item, matchedIndices: computeHighlight(item.name, query) }] : [];
        });
}

/** Best fuse score per person for one query token (lower is better, 0 = exact substring).
 *  A token too short for fuse still matches as a substring, so incremental typing works. */
function scoreToken(
    token: string,
    searchable: ReadonlyArray<PersonDescription>,
    nameVariants: Map<string, string[]>,
    fuse: Fuse<PersonDescription>,
): Map<string, number> {
    const variants = searchVariants(token);
    const scores = new Map<string, number>();
    for (const person of searchable) {
        const names = nameVariants.get(person.id) ?? [];
        if (names.some((name) => variants.some((v) => name.includes(v)))) {
            scores.set(person.id, 0);
        }
    }
    if (token.length < MIN_QUERY_LENGTH) return scores;
    for (const variant of variants) {
        for (const result of fuse.search(variant)) {
            const score = result.score ?? 1;
            const prior = scores.get(result.item.id);
            if (prior === undefined || score < prior) scores.set(result.item.id, score);
        }
    }
    return scores;
}

function computeHighlight(
    name: string,
    query: string,
): ReadonlyArray<PersonSearchMatch> {
    if (hasCyrillic(name) !== hasCyrillic(query)) return [];
    const fuse = new Fuse([normalizeRu(name)], HIGHLIGHT_OPTIONS);
    const indices = tokenize(query).flatMap(
        (token) => fuse.search(normalizeRu(token))[0]?.matches?.[0]?.indices ?? [],
    );
    return [...indices].sort((a, b) => a[0] - b[0]);
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
