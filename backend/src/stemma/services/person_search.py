"""Fuzzy person-name search, mirroring the frontend (`frontend/src/personSearch.ts`).

Same normalization (lowercase, ё→е, й→и) and Cyrillic→Latin transliteration variants, so a
query matches across spelling and alphabet. The frontend uses fuse.js; here the fuzzy step
is stdlib `difflib` (no dependency) — a substring always matches, otherwise a token/full
similarity ratio must clear a threshold.
"""

import difflib

MIN_QUERY_LENGTH = 2
FUZZY_THRESHOLD = 0.7
DEFAULT_LIMIT = 20

_GOST = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
    "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "iu", "я": "ia",
}
_BGN_PCGN = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "zh", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}
_NAIVE = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "zh", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "i", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}
_SCHEMES = (_GOST, _BGN_PCGN, _NAIVE)


def normalize_ru(value: str) -> str:
    return value.lower().replace("ё", "е").replace("й", "и")


def has_cyrillic(value: str) -> bool:
    return any("Ѐ" <= ch <= "ӿ" for ch in value)


def to_latin_variants(value: str) -> set[str]:
    lower = value.lower()
    if not has_cyrillic(lower):
        return {lower}
    return {"".join(scheme.get(ch, ch) for ch in lower) for scheme in _SCHEMES}


def search_variants(value: str) -> set[str]:
    variants = to_latin_variants(value)
    if has_cyrillic(value):
        variants.add(normalize_ru(value))
    return variants


def _best_score(query_variants: set[str], name_variants: set[str]) -> float:
    best = 0.0
    for query in query_variants:
        for name in name_variants:
            if query in name:
                return 1.0
            candidates = [name, *name.split()]
            best = max(best, *(difflib.SequenceMatcher(None, query, c).ratio() for c in candidates))
    return best


def search_people(query: str, people: list[dict], limit: int = DEFAULT_LIMIT) -> list[dict]:
    """Return the people whose name fuzzily matches `query`, best first. Blank-named
    (unknown) people are skipped, matching the frontend."""
    if len(query.strip()) < MIN_QUERY_LENGTH:
        return []
    query_variants = search_variants(query)
    scored: list[tuple[float, dict]] = []
    for person in people:
        name = person.get("name") or ""
        if not name.strip():
            continue
        score = _best_score(query_variants, search_variants(name))
        if score >= FUZZY_THRESHOLD:
            scored.append((score, person))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [person for _score, person in scored[:limit]]
