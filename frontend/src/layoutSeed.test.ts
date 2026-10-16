import { seedFromKnown } from "./initialLayout";

type N = { id: string };
type L = { source: string; target: string };

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("seedFromKnown", () => {
    // p1 + p2 -> f1 -> c1 (c1 is new)
    const nodes: N[] = [{ id: "person_p1" }, { id: "person_p2" }, { id: "family_f1" }, { id: "person_c1" }];
    const links: L[] = [
        { source: "person_p1", target: "family_f1" },
        { source: "person_p2", target: "family_f1" },
        { source: "family_f1", target: "person_c1" },
    ];
    const known = new Map<string, [number, number]>([
        ["person_p1", [0, 0]],
        ["person_p2", [200, 0]],
        ["family_f1", [100, 60]],
    ]);

    test("a new child is placed just below its family", () => {
        const seeded = seedFromKnown(nodes, links, known);
        const c = seeded.get("person_c1")!;
        expect(c).toBeDefined();
        expect(c[1]).toBeGreaterThan(60);
        expect(dist(c, [100, 60])).toBeLessThan(150);
        expect(seeded.has("person_p1")).toBe(false); // known nodes are not reseeded
    });

    test("a chain of new nodes grows outward from the known ones", () => {
        const n2 = [...nodes, { id: "family_f2" }, { id: "person_g1" }];
        const l2 = [...links, { source: "person_c1", target: "family_f2" }, { source: "family_f2", target: "person_g1" }];
        const seeded = seedFromKnown(n2, l2, known);
        const c = seeded.get("person_c1")!;
        const f2 = seeded.get("family_f2")!;
        const g = seeded.get("person_g1")!;
        expect(dist(c, f2)).toBeLessThan(150);
        expect(dist(f2, g)).toBeLessThan(150);
        expect(g[1]).toBeGreaterThan(c[1]);
    });

    test("new siblings do not land on the same spot", () => {
        const n2 = [...nodes, { id: "person_c2" }];
        const l2 = [...links, { source: "family_f1", target: "person_c2" }];
        const seeded = seedFromKnown(n2, l2, known);
        expect(dist(seeded.get("person_c1")!, seeded.get("person_c2")!)).toBeGreaterThan(10);
    });

    test("a component with no known relative goes beside the known layout, keeping its own shape", () => {
        const n2 = [...nodes, { id: "person_x" }, { id: "person_y" }];
        const fallback = new Map<string, [number, number]>([
            ["person_x", [0, 0]],
            ["person_y", [160, 0]],
        ]);
        const seeded = seedFromKnown(n2, links, known, fallback);
        const x = seeded.get("person_x")!;
        const y = seeded.get("person_y")!;
        expect(x[0]).toBeGreaterThan(200); // right of the known bbox
        expect(y[0] - x[0]).toBeCloseTo(160);
    });

    test("is deterministic", () => {
        expect([...seedFromKnown(nodes, links, known)]).toEqual([...seedFromKnown(nodes, links, known)]);
    });
});
