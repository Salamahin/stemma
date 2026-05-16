import type { StemmaIndex } from "./stemmaIndex";
import type { FamilyDescription, PersonDescription } from "./model";
import { normalizeId } from "./graphTools";

export type LayoutOptions = {
    generationHeight?: number;
    personSpacing?: number;
};

type PersonLike = Pick<PersonDescription, "id">;
type FamilyLike = Pick<FamilyDescription, "id" | "parents" | "children">;

export function computeInitialLayout(
    stemmaIndex: StemmaIndex,
    people: PersonLike[],
    families: FamilyLike[],
    width: number,
    height: number,
    options: LayoutOptions = {}
): Map<string, [number, number]> {
    const generationHeight = options.generationHeight ?? 200;
    const personSpacing = options.personSpacing ?? 160;

    const positions = new Map<string, [number, number]>();
    if (people.length === 0) return positions;

    const parentsOf = new Map<string, string[]>();
    families.forEach((f) => {
        f.children.forEach((c) => {
            const arr = parentsOf.get(c) ?? [];
            arr.push(...f.parents);
            parentsOf.set(c, arr);
        });
    });

    const byGen = new Map<number, string[]>();
    let maxGen = 0;
    people.forEach((p) => {
        const gen = stemmaIndex.lineage(p.id).generation;
        maxGen = Math.max(maxGen, gen);
        const arr = byGen.get(gen) ?? [];
        arr.push(p.id);
        byGen.set(gen, arr);
    });

    const totalHeight = Math.max(maxGen, 1) * generationHeight;
    const topY = height / 2 - totalHeight / 2;

    const assignedX = new Map<string, number>();
    const sortedGens = [...byGen.keys()].sort((a, b) => a - b);

    sortedGens.forEach((gen) => {
        const ids = byGen.get(gen)!;
        const tentative = new Map<string, number>();
        ids.forEach((id) => {
            const parents = parentsOf.get(id) ?? [];
            const parentXs = parents
                .map((pid) => assignedX.get(pid))
                .filter((v): v is number => v !== undefined);
            if (parentXs.length > 0) {
                tentative.set(id, parentXs.reduce((s, x) => s + x, 0) / parentXs.length);
            }
        });

        ids.sort((a, b) => {
            const ta = tentative.get(a);
            const tb = tentative.get(b);
            if (ta !== undefined && tb !== undefined) return ta - tb || a.localeCompare(b);
            if (ta !== undefined) return -1;
            if (tb !== undefined) return 1;
            return a.localeCompare(b);
        });

        const y = topY + gen * generationHeight;
        const rowWidth = Math.max(ids.length - 1, 0) * personSpacing;
        const startX = width / 2 - rowWidth / 2;

        ids.forEach((id, i) => {
            const x = startX + i * personSpacing;
            assignedX.set(id, x);
            positions.set(normalizeId("person", id), [x, y]);
        });
    });

    families.forEach((f) => {
        const memberIds = [...f.parents, ...f.children];
        const pts = memberIds
            .map((id) => positions.get(normalizeId("person", id)))
            .filter((p): p is [number, number] => Array.isArray(p));

        let x: number;
        let y: number;
        if (pts.length === 0) {
            x = width / 2;
            y = height / 2;
        } else {
            x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
            y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        }
        positions.set(normalizeId("family", f.id), [x, y]);
    });

    return positions;
}
