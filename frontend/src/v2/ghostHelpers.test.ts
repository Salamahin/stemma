import {
    buildStubPayload,
    canAddParentToFamily,
    toPersonArg,
    type GhostStubContext,
} from "./ghostHelpers";
import type { CreateNewPerson, FamilyDescription, PersonDescription } from "../model";

function family(parents: string[], children: string[] = []): FamilyDescription {
    return { type: "FamilyDescription", id: "f1", parents, children, readOnly: false };
}

function person(id: string, name = "P"): PersonDescription {
    return { type: "PersonDescription", id, name, readOnly: false };
}

function newPerson(name: string): CreateNewPerson {
    return { type: "CreateNewPerson", name };
}

describe("canAddParentToFamily", () => {
    test("zero parents", () => {
        expect(canAddParentToFamily(family([]))).toBe(true);
    });
    test("one parent", () => {
        expect(canAddParentToFamily(family(["p1"]))).toBe(true);
    });
    test("two parents", () => {
        expect(canAddParentToFamily(family(["p1", "p2"]))).toBe(false);
    });
    test("null family treated as available", () => {
        expect(canAddParentToFamily(null)).toBe(true);
    });
});

describe("toPersonArg", () => {
    test("existing person maps to ExistingPerson arg", () => {
        expect(toPersonArg(person("p7"))).toEqual({ type: "ExistingPerson", id: "p7" });
    });
    test("new person passes through", () => {
        const np = newPerson("Alice");
        expect(toPersonArg(np)).toBe(np);
    });
});

describe("buildStubPayload", () => {
    const stub: GhostStubContext = { stubId: "s1", anchorPersonId: "anchor", anchorRole: "parent" };

    test("addChild with new person", () => {
        const payload = buildStubPayload(stub, "addChild", newPerson("Kid"));
        expect(payload).toEqual({
            stubId: "s1",
            anchorPersonId: "anchor",
            anchorRole: "parent",
            action: "addChild",
            newPerson: { type: "CreateNewPerson", name: "Kid" },
        });
        expect(payload.existingPersonId).toBeUndefined();
    });

    test("addParent with existing person", () => {
        const payload = buildStubPayload(stub, "addParent", { type: "ExistingPerson", id: "p9" });
        expect(payload).toEqual({
            stubId: "s1",
            anchorPersonId: "anchor",
            anchorRole: "parent",
            action: "addParent",
            existingPersonId: "p9",
        });
        expect(payload.newPerson).toBeUndefined();
    });
});
