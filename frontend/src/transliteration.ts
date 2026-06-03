type Scheme = Readonly<Record<string, string>>;

const GOST: Scheme = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "iu", я: "ia",
};

const BGN_PCGN: Scheme = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

const NAIVE: Scheme = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

const SCHEMES: ReadonlyArray<Scheme> = [GOST, BGN_PCGN, NAIVE];

const CYRILLIC_RANGE = /[Ѐ-ӿ]/;

export function hasCyrillic(input: string): boolean {
    return CYRILLIC_RANGE.test(input);
}

export function toLatinVariants(input: string): string[] {
    const lower = input.toLowerCase();
    if (!hasCyrillic(lower)) return [lower];
    const variants = new Set<string>();
    for (const scheme of SCHEMES) variants.add(applyScheme(lower, scheme));
    return [...variants];
}

function applyScheme(value: string, scheme: Scheme): string {
    let out = "";
    for (const ch of value) out += ch in scheme ? scheme[ch] : ch;
    return out;
}
