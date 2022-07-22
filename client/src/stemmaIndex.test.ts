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

let jjFamily: Stemma = {
    people: [
        { id: "Jane", name: "Jane", readOnly: false },
        { id: "John", name: "John", readOnly: false },
        { id: "Josh", name: "Josh", readOnly: false },
        { id: "Jill", name: "Jill", readOnly: false },
        { id: "Jake", name: "Jake", readOnly: false },
        { id: "James", name: "James", readOnly: false },
        { id: "July", name: "July", readOnly: false },
        { id: "Jeff", name: "Jeff", readOnly: false },
        { id: "Joseph", name: "Joseph", readOnly: false },

    ],
    families: [
        { id: "f1", parents: ["Jane", "John"], "children": ["Josh", "Jill"], readOnly: false },
        { id: "f2", parents: ["Jill", "Jake"], "children": ["James"], readOnly: false },
        { id: "f3", parents: ["July"], "children": ["Jake"], readOnly: false },
        { id: "f4", parents: ["James"], "children": ["Jeff"], readOnly: false },
        { id: "f5", parents: ["Joseph"], "children": ["July"], readOnly: false },
    ]
}

test('Jane is the first in her lineage and is a direct relative of Josh, Jill, James and Jeff', () => {
    let lineage = new StemmaIndex(jjFamily).lineage("Jane")
    expect(lineage).toEqual({
        generation: 0,
        relativies: new Set(["Jane", "Jeff", "James", "Jill", "Josh"]),
        families: new Set(["f1", "f2", "f4"])
    })
});

test("July is the second in her lineage and is a direct relative of Joseph, Jake, James and Jeff", () => {
    let lineage = new StemmaIndex(jjFamily).lineage("July")
    expect(lineage).toEqual({
        generation: 1,
        relativies: new Set(["July", "Jake", "James", "Jeff", "Joseph"]),
        families: new Set(["f5", "f4", "f2", "f3"])
    })
});

test("Generation is selected as max known generations count", () => {
    let lineage = new StemmaIndex(jjFamily).lineage("Jeff")
    expect(lineage).toEqual({
        generation: 4, //Joseph's bloodline
        relativies: new Set(["July", "Jake", "Joseph", "Jill", "James", "Jane", "John", "Jeff"]),
        families: new Set(["f1", "f2", "f3", "f4", "f5"])
    })
})

test("lineage takes into account all children from all families", () => {
    let mashaFamily = {
        families: [
            { id: "f1", parents: ["masha", "katya"], children: ["petya"], readOnly: false },
            { id: "f2", parents: ["masha", "dasha"], children: ["lena"], readOnly: false },
        ],
        people: [
            { id: "masha", name: "masha", readOnly: false },
            { id: "katya", name: "katya", readOnly: false },
            { id: "petya", name: "petya", readOnly: false },
            { id: "dasha", name: "dasha", readOnly: false },
            { id: "lena", name: "lena", readOnly: false },
        ],
    }

    let lineage = new StemmaIndex(mashaFamily).lineage("masha")
    expect(lineage).toEqual({
        generation: 0,
        relativies: new Set(["masha", "petya", "lena"]),
        families: new Set(["f1", "f2"])
    })
})

test("calculates max generation", () => {
    let maxGeneration = new StemmaIndex(jjFamily).maxGeneration()
    expect(maxGeneration).toEqual(4)
})

test("lineage skips empty families", () => {
    let mashaFamily = {
        families: [
            { id: "f1", parents: ["masha", "katya"], children: [] , readOnly:false},
        ],
        people: [
            { id: "masha", name: "masha" , readOnly:false},
            { id: "katya", name: "katya" , readOnly:false}
        ],
    }

    let lineage = new StemmaIndex(mashaFamily).lineage("masha")
    expect(lineage).toEqual({
        generation: 0,
        relativies: new Set(["masha"]),
        families: new Set([])
    })
})