import type { Stemma } from "./model";
import type { Locale } from "./i18n";

export type Clan = {
    surname: string;
    plural: string;
    color: string;
    personIds: ReadonlySet<string>;
};

export function extractSurname(name: string | null | undefined): string {
    if (!name) return "";
    const trimmed = name.trim();
    if (!trimmed) return "";
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1];
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
    const parent = new Map<string, string>();
    for (const p of stemma.people) parent.set(p.id, p.id);

    const find = (start: string): string => {
        let root = start;
        while (parent.get(root) !== root) root = parent.get(root)!;
        let cur = start;
        while (parent.get(cur) !== root) {
            const next = parent.get(cur)!;
            parent.set(cur, root);
            cur = next;
        }
        return root;
    };
    const union = (a: string, b: string) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
    };

    for (const f of stemma.families) {
        const members = [...(f.parents ?? []), ...(f.children ?? [])].filter(m => parent.has(m));
        for (let i = 1; i < members.length; i++) union(members[0], members[i]);
    }

    const components = new Map<string, string[]>();
    for (const p of stemma.people) {
        const root = find(p.id);
        const bucket = components.get(root);
        if (bucket) bucket.push(p.id);
        else components.set(root, [p.id]);
    }

    const peopleById = new Map(stemma.people.map(p => [p.id, p]));
    const canonicalOf = (id: string) => canonicalSurname(extractSurname(peopleById.get(id)?.name));
    const clans: Clan[] = [];
    for (const members of components.values()) {
        if (members.length < 2) continue;
        const bySurname = new Map<string, string[]>();
        for (const id of members) {
            const key = canonicalOf(id);
            if (!key) continue;
            const bucket = bySurname.get(key);
            if (bucket) bucket.push(id);
            else bySurname.set(key, [id]);
        }
        for (const [surname, ids] of bySurname) {
            if (ids.length < 2) continue;
            clans.push({
                surname,
                plural: pluralizeSurname(surname, locale),
                color: clanColor(surname),
                personIds: new Set(ids),
            });
        }
    }
    return clans;
}
