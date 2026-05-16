import { StemmaIndex } from "./stemmaIndex";
import type { FamilyDescription, PersonDescription, Stemma } from "./model";
import { computeInitialLayout } from "./initialLayout";
import { normalizeId } from "./graphTools";

const person = (o: Omit<PersonDescription, "type">): PersonDescription => ({ type: "PersonDescription", ...o });
const family = (o: Omit<FamilyDescription, "type">): FamilyDescription => ({ type: "FamilyDescription", ...o });
const stemma = (o: Omit<Stemma, "type">): Stemma => ({ type: "Stemma", ...o });

const W = 1000;
const H = 800;

test("everyone in the same generation shares the same y, descendants sit below ancestors", () => {
    const data = stemma({
        people: [
            person({ id: "a", name: "A", readOnly: false }),
            person({ id: "b", name: "B", readOnly: false }),
            person({ id: "c", name: "C", readOnly: false }),
        ],
        families: [family({ id: "f1", parents: ["a", "b"], children: ["c"], readOnly: false })],
    });

    const idx = new StemmaIndex(data);
    const layout = computeInitialLayout(idx, data.people, data.families, W, H);

    const ay = layout.get(normalizeId("person", "a"))![1];
    const by = layout.get(normalizeId("person", "b"))![1];
    const cy = layout.get(normalizeId("person", "c"))![1];

    expect(ay).toEqual(by);
    expect(cy).toBeGreaterThan(ay);
});

test("child sits horizontally between its parents (barycenter)", () => {
    const data = stemma({
        people: [
            person({ id: "p1", name: "P1", readOnly: false }),
            person({ id: "p2", name: "P2", readOnly: false }),
            person({ id: "p3", name: "P3", readOnly: false }),
            person({ id: "p4", name: "P4", readOnly: false }),
            person({ id: "c", name: "C", readOnly: false }),
        ],
        families: [
            family({ id: "fA", parents: ["p1", "p2"], children: [], readOnly: false }),
            family({ id: "fB", parents: ["p3", "p4"], children: [], readOnly: false }),
            family({ id: "fC", parents: ["p2", "p3"], children: ["c"], readOnly: false }),
        ],
    });

    const idx = new StemmaIndex(data);
    const layout = computeInitialLayout(idx, data.people, data.families, W, H);

    const p2x = layout.get(normalizeId("person", "p2"))![0];
    const p3x = layout.get(normalizeId("person", "p3"))![0];
    const cx = layout.get(normalizeId("person", "c"))![0];

    const minX = Math.min(p2x, p3x);
    const maxX = Math.max(p2x, p3x);
    expect(cx).toBeGreaterThanOrEqual(minX);
    expect(cx).toBeLessThanOrEqual(maxX);
});

test("family node sits at the centroid of its members", () => {
    const data = stemma({
        people: [
            person({ id: "m", name: "M", readOnly: false }),
            person({ id: "f", name: "F", readOnly: false }),
            person({ id: "k", name: "K", readOnly: false }),
        ],
        families: [family({ id: "fam", parents: ["m", "f"], children: ["k"], readOnly: false })],
    });

    const idx = new StemmaIndex(data);
    const layout = computeInitialLayout(idx, data.people, data.families, W, H);

    const m = layout.get(normalizeId("person", "m"))!;
    const f = layout.get(normalizeId("person", "f"))!;
    const k = layout.get(normalizeId("person", "k"))!;
    const fam = layout.get(normalizeId("family", "fam"))!;

    const cx = (m[0] + f[0] + k[0]) / 3;
    const cy = (m[1] + f[1] + k[1]) / 3;
    expect(fam[0]).toBeCloseTo(cx);
    expect(fam[1]).toBeCloseTo(cy);
});

test("layout is deterministic across calls (stable input → stable output)", () => {
    const data = stemma({
        people: [
            person({ id: "x", name: "X", readOnly: false }),
            person({ id: "y", name: "Y", readOnly: false }),
            person({ id: "z", name: "Z", readOnly: false }),
        ],
        families: [family({ id: "f1", parents: ["x"], children: ["y", "z"], readOnly: false })],
    });

    const idx = new StemmaIndex(data);
    const a = computeInitialLayout(idx, data.people, data.families, W, H);
    const b = computeInitialLayout(idx, data.people, data.families, W, H);

    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
});

test("disconnected sub-trees are laid out without throwing", () => {
    const data = stemma({
        people: [
            person({ id: "a1", name: "A1", readOnly: false }),
            person({ id: "a2", name: "A2", readOnly: false }),
            person({ id: "b1", name: "B1", readOnly: false }),
            person({ id: "b2", name: "B2", readOnly: false }),
        ],
        families: [
            family({ id: "fA", parents: ["a1"], children: ["a2"], readOnly: false }),
            family({ id: "fB", parents: ["b1"], children: ["b2"], readOnly: false }),
        ],
    });

    const idx = new StemmaIndex(data);
    const layout = computeInitialLayout(idx, data.people, data.families, W, H);

    expect(layout.has(normalizeId("person", "a1"))).toBe(true);
    expect(layout.has(normalizeId("person", "b1"))).toBe(true);
    // Both trees occupy the same generation rows
    expect(layout.get(normalizeId("person", "a1"))![1]).toEqual(layout.get(normalizeId("person", "b1"))![1]);
    expect(layout.get(normalizeId("person", "a2"))![1]).toEqual(layout.get(normalizeId("person", "b2"))![1]);
});

test("empty stemma returns empty layout", () => {
    const data = stemma({ people: [], families: [] });
    const idx = new StemmaIndex(data);
    const layout = computeInitialLayout(idx, data.people, data.families, W, H);
    expect(layout.size).toBe(0);
});
