/**
 * Birth years in a few clearly different steps instead of a smooth gradient:
 * on small nodes the eye tells "another colour" apart, not "a slightly
 * different shade". The step size fits the tree — centuries for royal
 * genealogies, half-centuries for a family over a couple of hundred years.
 */

/** Candidate step sizes, finest first; the finest one that gives at most MAX_STEPS wins. */
const STEP_SIZES = [10, 25, 50, 100, 200, 500];
const MAX_STEPS = 6;
/** The span is taken between these percentiles, so a stray date does not coarsen every step. */
const SPAN_PERCENTILES: [number, number] = [0.02, 0.98];

export type AgeSteps = {
    /** Years per step. */
    size: number;
    count: number;
    /** Per step: the century in Roman numerals for 100-year steps, else the first year. */
    labels: string[];
    /** The step of a birth year (years outside the span go to the first or last step). */
    stepOf(year: number): number;
};

const ROMAN: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

/** 1596 → "XVI", 1900 → "XX": the everyday count (1900–1999 is the XX century), not the strict 1901–2000. */
export function romanCentury(year: number): string {
    let n = Math.floor(year / 100) + 1;
    let out = "";
    for (const [v, s] of ROMAN) {
        while (n >= v) {
            out += s;
            n -= v;
        }
    }
    return out;
}

export function ageSteps(years: number[]): AgeSteps | null {
    if (!years.length) return null;
    const sorted = [...years].sort((a, b) => a - b);
    const lo = sorted[Math.floor(SPAN_PERCENTILES[0] * (sorted.length - 1))];
    const hi = sorted[Math.ceil(SPAN_PERCENTILES[1] * (sorted.length - 1))];

    const startOf = (size: number, y: number) => Math.floor(y / size) * size;
    const stepsFor = (size: number) => Math.floor((startOf(size, hi) - startOf(size, lo)) / size) + 1;
    const size = STEP_SIZES.find((s) => stepsFor(s) <= MAX_STEPS) ?? STEP_SIZES[STEP_SIZES.length - 1];
    const first = startOf(size, lo);
    const count = stepsFor(size);

    const labels = Array.from({ length: count }, (_, i) => {
        const from = first + i * size;
        return size === 100 ? romanCentury(from) : String(from);
    });
    return {
        size,
        count,
        labels,
        stepOf: (year) => Math.min(count - 1, Math.max(0, Math.floor((startOf(size, year) - first) / size))),
    };
}
