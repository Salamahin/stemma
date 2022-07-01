import { Generation } from './generation'
import { Lineage } from './generation'
import { Stemma } from './model';

/*
    JJ family:

    joseph
         \
         july             jane + john 
             \           /           \
              jake + jill             josh
                         \
                          james 
                               \
                                jeff
*/

let jjFamily: Stemma = {
    people: [
        { id: "Jane", name: "Jane" },
        { id: "John", name: "John" },
        { id: "Josh", name: "Josh" },
        { id: "Jill", name: "Jill" },
        { id: "Jake", name: "Jake" },
        { id: "James", name: "James" },
        { id: "July", name: "July" },
        { id: "Jeff", name: "Jeff" },
        { id: "Joseph", name: "Joseph" },

    ],
    families: [
        { id: "f1", parents: ["Jane", "John"], "children": ["Josh", "Jill"] },
        { id: "f2", parents: ["Jill", "Jake"], "children": ["James"] },
        { id: "f3", parents: ["July"], "children": ["Jake"] },
        { id: "f4", parents: ["James"], "children": ["Jeff"] },
        { id: "f5", parents: ["Joseph"], "children": ["July"] },
    ]
}

test('Jane is the first in her lineage and is a direct relative of Josh, Jill, James and Jeff', () => {
    let lineages = new Lineage(jjFamily).lineages()
    expect(lineages.get("Jane")).toEqual({
        generation: 0,
        relativies: new Set(["Jane", "Jeff", "James", "Jill", "Josh"])
    })
});

test("July is the second in her lineage and is a direct relative of Joseph, Jake, James and Jeff", () => {
    let lineages = new Lineage(jjFamily).lineages()
    expect(lineages.get("July")).toEqual({
        generation: 1,
        relativies: new Set(["July", "Jake", "James", "Jeff", "Joseph"])
    })
});

test("Generation is selected as max known generations count", () => {
    let lineages = new Lineage(jjFamily).lineages()
    expect(lineages.get("Jeff")).toEqual({
        generation: 4, //Joseph's bloodline
        relativies: new Set(["July", "Jake", "Joseph", "Jill", "James", "Jane", "John", "Jeff"])
    })
})