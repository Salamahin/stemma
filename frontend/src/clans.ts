import type { Stemma } from "./model";
import type { Locale } from "./i18n";

export type Clan = {
    surname: string;
    plural: string;
    color: string;
    personIds: ReadonlySet<string>;
};

const ROMAN_RE = /^[IVXLCDM]+$/;
const MIN_TOKEN_LEN = 3;
const MIN_CLAN_MEMBERS = 6;
const MIN_CLAN_GENERATIONS = 3;

// Titles + very common given names that propagate across generations and are not
// dynastic markers. Lowercased for case-insensitive matching.
const STOP_TOKENS = new Set([
    "принц", "принцесса", "король", "королева", "царь", "царица",
    "царевич", "царевна", "цесаревич", "цесаревна", "император", "императрица",
    "герцог", "герцогиня", "князь", "княгиня", "граф", "графиня",
    "великий", "великая", "консорт", "наследник", "наследница", "монарх",
    "регент", "старшая", "младшая", "королевская", "королевский",
    "мария", "михаил", "александр", "александра", "анна", "иван", "пётр", "петр",
    "николай", "павел", "алексей", "екатерина", "елизавета", "людвиг",
    "карл", "вильгельм", "виктория", "виктор", "ольга", "татьяна", "софья",
    "фридрих", "кристиан", "хокон", "хенрик", "альберт", "эдуард", "георг",
    "ингрид", "марта", "дмитрий", "глеб", "борис", "сергей", "ярослав",
    "святослав", "владимир", "андрей", "константин", "леонид", "юрий",
    "филипп", "генрих", "леопольд", "альфред", "артур", "альфонсо",
    "хуан", "фелипе", "уильям", "гарри", "чарльз", "эндрю", "эдвард",
    "софи", "софия", "шарлотта", "луиза", "хелена", "беатрис", "ирина",
    "евдокия", "марфа", "наталья", "елена", "феодора", "феодосий",
    "александрович", "александровна", "михайлович", "михайловна",
    "алексеевич", "алексеевна", "петрович", "петровна", "николаевич",
    "николаевна", "павлович", "павловна", "иванович", "ивановна",
    "владимирович", "владимировна", "сергеевич", "сергеевна",
    "антонович", "антоновна", "васильевич", "васильевна",
    "иоаннович", "иоанновна", "юрьевич", "юрьевна", "андреевич", "андреевна",
    "феодорович", "фёдорович", "федорович",
]);

export function nameTokens(name: string | null | undefined): string[] {
    if (!name) return [];
    const trimmed = name.trim();
    if (!trimmed) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of trimmed.split(/\s+/)) {
        if (raw.length < MIN_TOKEN_LEN) continue;
        if (ROMAN_RE.test(raw)) continue;
        if (STOP_TOKENS.has(raw.toLowerCase())) continue;
        const tok = canonicalSurname(raw);
        if (!tok || seen.has(tok)) continue;
        if (STOP_TOKENS.has(tok.toLowerCase())) continue;
        seen.add(tok);
        out.push(tok);
    }
    return out;
}

export function canonicalSurname(surname: string): string {
    const s = surname;
    if (!s) return "";
    if (/(ская|цкая)$/u.test(s)) return s.slice(0, -2) + "ий";
    if (/(ова|ева|ёва|ына)$/u.test(s)) return s.slice(0, -1);
    if (/ина$/u.test(s)) return s.slice(0, -1);
    return s;
}

export function pluralizeSurname(surname: string, locale: Locale): string {
    if (!surname) return "";
    if (locale === "en") return surname + "s";
    const s = surname;
    if (/(овы|евы|ёвы|ины|ыны|ские|цкие)$/u.test(s)) return s;
    if (/(ский|цкий)$/u.test(s)) return s.slice(0, -2) + "ие";
    if (/(ская|цкая)$/u.test(s)) return s.slice(0, -2) + "ие";
    if (/(ов|ев|ёв|ын)$/u.test(s)) return s + "ы";
    if (/(ова|ева|ёва|ына)$/u.test(s)) return s.slice(0, -1) + "ы";
    if (/ин$/u.test(s)) return s + "ы";
    if (/ина$/u.test(s)) return s.slice(0, -1) + "ы";
    return s + "ы";
}

export function clanColor(surname: string): string {
    let h = 0;
    for (let i = 0; i < surname.length; i++) {
        h = (h * 31 + surname.charCodeAt(i)) | 0;
    }
    const hue = ((h % 360) + 360) % 360;
    return `hsl(${hue}, 65%, 55%)`;
}

export function computeClans(stemma: Stemma, locale: Locale): Clan[] {
    // Family-graph adjacency: two persons share an edge if they appear together
    // in any family (spouses, parent-child, or siblings sharing parents).
    const neighbors = new Map<string, Set<string>>();
    const kidsOf = new Map<string, Set<string>>();
    const addEdge = (a: string, b: string) => {
        if (a === b) return;
        let s = neighbors.get(a);
        if (!s) { s = new Set(); neighbors.set(a, s); }
        s.add(b);
    };
    for (const f of stemma.families) {
        const parents = f.parents ?? [];
        const children = f.children ?? [];
        for (const p of parents) {
            for (const c of children) {
                let kids = kidsOf.get(p);
                if (!kids) { kids = new Set(); kidsOf.set(p, kids); }
                kids.add(c);
            }
        }
        const members = [...parents, ...children];
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                addEdge(members[i], members[j]);
                addEdge(members[j], members[i]);
            }
        }
    }

    // Tokens per person
    const tokensById = new Map<string, string[]>();
    const tokenToCarriers = new Map<string, Set<string>>();
    for (const p of stemma.people) {
        const toks = nameTokens(p.name);
        tokensById.set(p.id, toks);
        for (const t of toks) {
            let s = tokenToCarriers.get(t);
            if (!s) { s = new Set(); tokenToCarriers.set(t, s); }
            s.add(p.id);
        }
    }

    // True iff the carrier-component spans at least N generations — i.e. there is a
    // chain root → ... → descendant (depth ≥ N-1) where every two carriers we count
    // are members of `component`. Filters out one-or-two-generation noise like
    // sibling-only patronymic groups or mom+daughter same-first-name pairs.
    const spansGenerations = (component: Set<string>, minGenerations: number): boolean => {
        for (const start of component) {
            // DFS through descendants; only step into carrier children. Depth counts
            // carriers along the chain.
            const stack: Array<{ id: string; depth: number }> = [{ id: start, depth: 1 }];
            const seen = new Set<string>();
            while (stack.length) {
                const { id, depth } = stack.pop()!;
                if (seen.has(id)) continue;
                seen.add(id);
                if (depth >= minGenerations) return true;
                const kids = kidsOf.get(id);
                if (!kids) continue;
                for (const k of kids) {
                    if (!component.has(k) || seen.has(k)) continue;
                    stack.push({ id: k, depth: depth + 1 });
                }
            }
        }
        return false;
    };

    // For each token, find connected components within the subgraph of its carriers.
    const clans: Clan[] = [];
    for (const [token, carriers] of tokenToCarriers) {
        if (carriers.size < MIN_CLAN_MEMBERS) continue;
        const visited = new Set<string>();
        for (const start of carriers) {
            if (visited.has(start)) continue;
            const component = new Set<string>();
            const stack = [start];
            while (stack.length) {
                const cur = stack.pop()!;
                if (visited.has(cur)) continue;
                visited.add(cur);
                component.add(cur);
                const nbrs = neighbors.get(cur);
                if (!nbrs) continue;
                for (const n of nbrs) {
                    if (!visited.has(n) && carriers.has(n)) stack.push(n);
                }
            }
            if (component.size < MIN_CLAN_MEMBERS) continue;
            if (!spansGenerations(component, MIN_CLAN_GENERATIONS)) continue;
            clans.push({
                surname: token,
                plural: pluralizeSurname(token, locale),
                color: clanColor(token),
                personIds: component,
            });
        }
    }
    return clans;
}
