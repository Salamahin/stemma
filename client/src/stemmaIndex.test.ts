import { Generation } from './stemmaIndex'
import { StemmaIndex } from './stemmaIndex'
import { Stemma } from './model';

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

let jjFamily: Stemma = {
    people: [
        { id: jane, name: "Jane", readOnly: false },
        { id: john, name: "John", readOnly: false },
        { id: josh, name: "Josh", readOnly: false },
        { id: jill, name: "Jill", readOnly: false },
        { id: jake, name: "Jake", readOnly: false },
        { id: james, name: "James", readOnly: false },
        { id: july, name: "July", readOnly: false },
        { id: jeff, name: "Jeff", readOnly: false },
        { id: joseph, name: "Joseph", readOnly: false },

    ],
    families: [
        { id: "1", parents: [jane, john], "children": [josh, jill], readOnly: false },
        { id: "2", parents: [jill, jake], "children": [james], readOnly: false },
        { id: "3", parents: [july], "children": [jake], readOnly: false },
        { id: "4", parents: [james], "children": [jeff], readOnly: false },
        { id: "5", parents: [joseph], "children": [july], readOnly: false },
    ]
}

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
    let mashaFamily = {
        families: [
            { id: "1", parents: [masha, katya], children: [petya], readOnly: false },
            { id: "2", parents: [masha, dasha], children: [lena], readOnly: false },
        ],
        people: [
            { id: masha, name: "masha", readOnly: false },
            { id: katya, name: "katya", readOnly: false },
            { id: petya, name: "petya", readOnly: false },
            { id: dasha, name: "dasha", readOnly: false },
            { id: lena, name: "lena", readOnly: false },
        ],
    }

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

test("lineage skips empty families", () => {
    let mashaFamily = {
        families: [
            { id: "1", parents: [masha, katya], children: [], readOnly: false },
        ],
        people: [
            { id: masha, name: "masha", readOnly: false },
            { id: katya, name: "katya", readOnly: false }
        ],
    }

    let lineage = new StemmaIndex(mashaFamily).lineage(masha)
    expect(lineage).toEqual({
        generation: 0,
        relativies: new Set([masha]),
        families: new Set([])
    })
})
