/**
 * Genealogical dates with explicit precision, as the backend stores them:
 * "YYYY", "YYYY-MM" or "YYYY-MM-DD", optionally prefixed with "~" (circa).
 */

type Parts = { approx: boolean; year: number; month: number | null; day: number | null };

const ISO = /^(~)?(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
// What people type: "1899", "03.1899", "16.03.1899", optionally after a circa marker.
const TYPED = /^(?:(\d{1,2})\.)?(?:(\d{1,2})\.)?(\d{4})$/;
const APPROX_PREFIX = /^(~|около|ок\.|ок(?=\s)|circa|ca\.|ca(?=\s)|c\.|c(?=\s)|about|abt\.?)\s*/i;

function daysIn(year: number, month: number) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function valid(p: Parts): boolean {
    if (p.month != null && (p.month < 1 || p.month > 12)) return false;
    if (p.day != null && (p.month == null || p.day < 1 || p.day > daysIn(p.year, p.month))) return false;
    return true;
}

function parseIso(value: string): Parts | null {
    const m = ISO.exec(value);
    if (!m) return null;
    const p = { approx: !!m[1], year: +m[2], month: m[3] ? +m[3] : null, day: m[4] ? +m[4] : null };
    return valid(p) ? p : null;
}

function toIso(p: Parts): string {
    const pad = (n: number, w: number) => String(n).padStart(w, "0");
    let s = pad(p.year, 4);
    if (p.month != null) s += "-" + pad(p.month, 2);
    if (p.month != null && p.day != null) s += "-" + pad(p.day, 2);
    return (p.approx ? "~" : "") + s;
}

function notInFuture(p: Parts): boolean {
    const now = new Date();
    const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
    if (p.year !== today.year) return p.year < today.year;
    if (p.month == null || p.month !== today.month) return p.month == null || p.month < today.month;
    return p.day == null || p.day <= today.day;
}

export type DateInputResult = { ok: true; value: string | null } | { ok: false };

/** Parses what a person typed into a date field into the stored form. */
export function parseDateInput(text: string): DateInputResult {
    let rest = text.trim();
    if (rest === "") return { ok: true, value: null };
    let approx = false;
    const prefix = APPROX_PREFIX.exec(rest);
    if (prefix) {
        approx = true;
        rest = rest.slice(prefix[0].length).trim();
    }
    let parts: Parts | null = parseIso(rest);
    if (parts) parts = { ...parts, approx: parts.approx || approx };
    else {
        const m = TYPED.exec(rest);
        if (!m) return { ok: false };
        // One leading group is a month ("03.1899"); two are day and month.
        const [day, month] = m[2] != null ? [+m[1], +m[2]] : [null, m[1] != null ? +m[1] : null];
        parts = { approx, year: +m[3], month, day };
        if (!valid(parts)) return { ok: false };
    }
    if (!notInFuture(parts)) return { ok: false };
    return { ok: true, value: toIso(parts) };
}

/** The stored form as the user would type it back ("~16.03.1899"). */
export function toDateInput(value: string | null | undefined): string {
    const p = value ? parseIso(value) : null;
    if (!p) return value ?? "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const body = [p.day != null ? pad(p.day) : null, p.month != null ? pad(p.month) : null, String(p.year).padStart(4, "0")]
        .filter((x) => x != null)
        .join(".");
    return (p.approx ? "~" : "") + body;
}

const APPROX_LABEL: Record<string, string> = { en: "c.", ru: "ок." };

// Creating an Intl.DateTimeFormat is slow; the chart formats thousands of dates at once.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = locale + JSON.stringify(options);
    let f = formatters.get(key);
    if (!f) formatters.set(key, (f = new Intl.DateTimeFormat(locale, options)));
    return f;
}

/** Human-readable date showing only the known precision ("Mar 1899", "ок. 1820"). */
export function formatPartialDate(value: string | null | undefined, locale: string): string {
    if (!value) return "";
    const p = parseIso(value);
    if (!p) return value;
    const date = new Date(Date.UTC(p.year, (p.month ?? 1) - 1, p.day ?? 1));
    let text: string;
    if (p.month == null) text = String(p.year);
    else if (p.day == null) {
        const month = formatter(locale, { month: locale === "ru" ? "long" : "short", timeZone: "UTC" }).format(date);
        text = `${month} ${p.year}`;
    } else {
        const dayMonth = formatter(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
        text = `${dayMonth} ${p.year}`;
    }
    return p.approx ? `${APPROX_LABEL[locale] ?? "~"} ${text}` : text;
}

/** True only when `a` is certainly earlier than `b` at the precision both know. */
export function isBefore(a: string, b: string): boolean {
    const pa = parseIso(a);
    const pb = parseIso(b);
    if (!pa || !pb || pa.approx || pb.approx) return false;
    if (pa.year !== pb.year) return pa.year < pb.year;
    if (pa.month == null || pb.month == null) return false;
    if (pa.month !== pb.month) return pa.month < pb.month;
    if (pa.day == null || pb.day == null) return false;
    return pa.day < pb.day;
}
