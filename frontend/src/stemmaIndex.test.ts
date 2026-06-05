import type { Generation } from './stemmaIndex'
import { StemmaIndex } from './stemmaIndex'
import type { FamilyDescription, PersonDescription, Stemma } from './model';

const person = (o: Omit<PersonDescription, "type">): PersonDescription => ({ type: "PersonDescription", ...o });
const family = (o: Omit<FamilyDescription, "type">): FamilyDescription => ({ type: "FamilyDescription", ...o });
const stemma = (o: Omit<Stemma, "type">): Stemma => ({ type: "Stemma", ...o });

/*
    JJ family:

    joseph (f5)
         \
         july (f3)        jane + john (f1)
             \           /           \
              jake + jill (f2)        josh
                         \
                          james (f4)
                               \
                                jeff
*/

const jane = "1"
const john = "2"
const josh = "3"
const jill = "4"
const jake = "5"
const james = "6"
const july = "7"
const jeff = "8"
const joseph = "9"

let jjFamily: Stemma = stemma({
    people: [
        person({ id: jane, name: "Jane", readOnly: false }),
        person({ id: john, name: "John", readOnly: false }),
        person({ id: josh, name: "Josh", readOnly: false }),
        person({ id: jill, name: "Jill", readOnly: false }),
        person({ id: jake, name: "Jake", readOnly: false }),
        person({ id: james, name: "James", readOnly: false }),
        person({ id: july, name: "July", readOnly: false }),
        person({ id: jeff, name: "Jeff", readOnly: false }),
        person({ id: joseph, name: "Joseph", readOnly: false }),
    ],
    families: [
        family({ id: "1", parents: [jane, john], children: [josh, jill], readOnly: false }),
        family({ id: "2", parents: [jill, jake], children: [james], readOnly: false }),
        family({ id: "3", parents: [july], children: [jake], readOnly: false }),
        family({ id: "4", parents: [james], children: [jeff], readOnly: false }),
        family({ id: "5", parents: [joseph], children: [july], readOnly: false }),
    ],
})

test('Jane is the first in her lineage and is a direct relative of Josh, Jill, James and Jeff', () => {
    let lineage = new StemmaIndex(jjFamily).lineage(jane)
    expect(lineage).toEqual({
        generation: 0,
        relativies: new Set([jane, jeff, james, jill, josh]),
        families: new Set(["1", "2", "4"])
    })
});

test("July is the second in her lineage and is a direct relative of Joseph, Jake, James and Jeff", () => {
    let lineage = new StemmaIndex(jjFamily).lineage(july)
    expect(lineage.generation).toEqual(1)
    expect([...lineage.relativies].sort()).toEqual([july, jake, james, jeff, joseph].sort())
    expect([...lineage.families].sort()).toEqual(["5", "4", "3", "2"].sort())
});

test("Generation is selected as max known generations count", () => {
    let lineage = new StemmaIndex(jjFamily).lineage(jeff)
    expect(lineage.generation).toEqual(4) //Joseph's bloodline
    expect([...lineage.relativies].sort()).toEqual([july, jake, joseph, jill, james, jane, john, jeff].sort())
    expect([...lineage.families].sort()).toEqual(["1", "2", "4", "5", "3"].sort())
})

const masha = "1"
const katya = "2"
const petya = "3"
const dasha = "4"
const lena = "5"

test("lineage takes into account all children from all families", () => {
    let mashaFamily = stemma({
        families: [
            family({ id: "1", parents: [masha, katya], children: [petya], readOnly: false }),
            family({ id: "2", parents: [masha, dasha], children: [lena], readOnly: false }),
        ],
        people: [
            person({ id: masha, name: "masha", readOnly: false }),
            person({ id: katya, name: "katya", readOnly: false }),
            person({ id: petya, name: "petya", readOnly: false }),
            person({ id: dasha, name: "dasha", readOnly: false }),
            person({ id: lena, name: "lena", readOnly: false }),
        ],
    })

    let lineage = new StemmaIndex(mashaFamily).lineage(masha)
    expect(lineage).toEqual({
        generation: 0,
        relativies: new Set([masha, petya, lena]),
        families: new Set(["1", "2"])
    })
})

test("calculates max generation", () => {
    let maxGeneration = new StemmaIndex(jjFamily).maxGeneration()
    expect(maxGeneration).toEqual(4)
})

describe("canAddParent / canAddChild", () => {
    const jjIndex = () => new StemmaIndex(jjFamily)

    test("canAddParent rejects when family already has two parents", () => {
        // family 1: parents [jane, john] — full
        expect(jjIndex().canAddParent("1", joseph)).toEqual({ ok: false, reason: "twoParents" })
    })

    test("canAddParent allows adding a parent to a single-parent family", () => {
        // family 3: parents [july] — has room
        expect(jjIndex().canAddParent("3", john)).toEqual({ ok: true })
    })

    test("canAddParent rejects if person is already a member of the family", () => {
        // family 3 (parents [july], children [jake]) — july would be duplicate parent, jake duplicate child
        expect(jjIndex().canAddParent("3", july)).toEqual({ ok: false, reason: "alreadyMember" })
        expect(jjIndex().canAddParent("3", jake)).toEqual({ ok: false, reason: "alreadyMember" })
    })

    test("canAddParent rejects when person is a descendant of the family (cycle)", () => {
        // family 5: parents [joseph], children [july]; jeff is descendant of family 5 via july→jake→james→jeff
        expect(jjIndex().canAddParent("5", jeff)).toEqual({ ok: false, reason: "cycle" })
    })

    test("canAddChild rejects if person already in family", () => {
        // family 1 has jane as parent, josh as child
        expect(jjIndex().canAddChild("1", jane)).toEqual({ ok: false, reason: "alreadyMember" })
        expect(jjIndex().canAddChild("1", josh)).toEqual({ ok: false, reason: "alreadyMember" })
    })

    test("canAddChild rejects when family is a descendant of the person (cycle)", () => {
        // family 4 (parents [james], children [jeff]) is descendant of joseph (joseph→f5→july→f3→jake→f2→james→f4)
        expect(jjIndex().canAddChild("4", joseph)).toEqual({ ok: false, reason: "cycle" })
    })

    test("canAddChild allows valid addition", () => {
        // family 4: parents [james], children [jeff]; josh has no descendant families
        expect(jjIndex().canAddChild("4", josh)).toEqual({ ok: true })
    })

    test("returns unknownFamily for missing id", () => {
        expect(jjIndex().canAddParent("zzz", jane)).toEqual({ ok: false, reason: "unknownFamily" })
        expect(jjIndex().canAddChild("zzz", jane)).toEqual({ ok: false, reason: "unknownFamily" })
    })
})

test("lineage skips empty families", () => {
    let mashaFamily = stemma({
        families: [
            family({ id: "1", parents: [masha, katya], children: [], readOnly: false }),
        ],
        people: [
            person({ id: masha, name: "masha", readOnly: false }),
            person({ id: katya, name: "katya", readOnly: false }),
        ],
    })

    let lineage = new StemmaIndex(mashaFamily).lineage(masha)
    expect(lineage).toEqual({
        generation: 0,
        relativies: new Set([masha]),
        families: new Set([])
    })
})
