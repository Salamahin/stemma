/**
 * v3 pending state + mutation actions that bridge ghost/drag affordances
 * and the backend through `AppController`.
 *
 * Reactive state (pending adds, pending families, removed sets) lives in
 * `V3App.svelte` as `$state`.  This class accesses it through getter/setter
 * refs passed in the constructor so the component owns the reactivity edge.
 */

import { get } from "svelte/store";
import { AppController, type MutationResult } from "../appController";
import type { CreateNewPerson, PersonDefinition } from "../model";
import { normalizeId } from "../graphTools";
import type { StemmaIndex } from "../stemmaIndex";
import { t as tStore } from "../i18n";
import {
    composeFamilyMembers,
    familyHasPerson,
    newPendingFamilyId,
    newPendingPersonId,
    type PendingAdd,
    type PendingFamily,
} from "./pendingState";
import type { FocusedId } from "./focusGesture";
import type { GhostKind } from "./ghostHelpers";

type CreatePersonArgs = {
    description: CreateNewPerson;
    pin: boolean;
    photoUpload: Blob | null;
};

type StemmaChartRef = {
    setNodePosition: (id: string, x: number, y: number) => void;
} | null;

type PersonModalRef = {
    showCreatePerson: (cfg: {
        title: string;
        oncreate: (args: CreatePersonArgs) => void;
    }) => void;
} | null;

export type Ref<T> = { get(): T; set(v: T): void };

type Deps = {
    controller: AppController;
    getStemmaIndex: () => StemmaIndex | null;
    getStemmaChart: () => StemmaChartRef;
    getPersonEditModal: () => PersonModalRef;
    addsRef: Ref<PendingAdd[]>;
    familiesRef: Ref<PendingFamily[]>;
    removedPersonIdsRef: Ref<Set<string>>;
    removedFamilyIdsRef: Ref<Set<string>>;
};

export class V3MutationActions {
    constructor(private deps: Deps) {}

    reset(): void {
        this.deps.addsRef.set([]);
        this.deps.familiesRef.set([]);
        this.deps.removedPersonIdsRef.set(new Set());
        this.deps.removedFamilyIdsRef.set(new Set());
    }

    findFamily(id: string): PendingFamily | undefined {
        return this.deps.familiesRef.get().find((f) => f.tempId === id);
    }

    cleanupIncompletePendingFamiliesOnExitEdit(): void {
        const current = this.deps.familiesRef.get();
        const filtered = current.filter((p) => p.parents.length + p.children.length >= 2);
        if (filtered.length !== current.length) this.deps.familiesRef.set(filtered);
    }

    private t(key: string, params?: Record<string, string>): string {
        return get(tStore)(key, params);
    }

    async withPendingAdd(
        name: string,
        op: () => Promise<MutationResult>,
        pinAt?: { x: number; y: number },
        afterCommit?: (result: MutationResult) => void,
    ): Promise<void> {
        const tempId = newPendingPersonId();
        this.deps.addsRef.set([...this.deps.addsRef.get(), { tempId, name }]);
        const chart = this.deps.getStemmaChart();
        if (pinAt) chart?.setNodePosition(normalizeId("person", tempId), pinAt.x, pinAt.y);
        try {
            const result = await op();
            if (pinAt) {
                result.newPersonIds.forEach((id) =>
                    chart?.setNodePosition(normalizeId("person", id), pinAt.x, pinAt.y),
                );
            }
            afterCommit?.(result);
        } catch {
            // surfaced through controller.err
        } finally {
            this.deps.addsRef.set(this.deps.addsRef.get().filter((p) => p.tempId !== tempId));
        }
    }

    createPendingFamilyForPerson(
        personId: string,
        role: "parent" | "child",
        familyAt: { x: number; y: number },
    ): PendingFamily {
        const tempId = newPendingFamilyId();
        const entry: PendingFamily = {
            tempId,
            parents: role === "parent" ? [personId] : [],
            children: role === "child" ? [personId] : [],
            x: familyAt.x,
            y: familyAt.y,
        };
        this.deps.getStemmaChart()?.setNodePosition(normalizeId("family", tempId), familyAt.x, familyAt.y);
        this.deps.familiesRef.set([...this.deps.familiesRef.get(), entry]);
        return entry;
    }

    promotePendingFamily(
        pending: PendingFamily,
        incoming: PersonDefinition,
        role: "parent" | "child",
    ): Promise<MutationResult> {
        const { parents, children } = composeFamilyMembers(pending.parents, pending.children, incoming, role);
        return this.deps.controller.createFamily(parents, children, { silent: true });
    }

    clearPendingFamily(tempId: string): void {
        this.deps.familiesRef.set(this.deps.familiesRef.get().filter((p) => p.tempId !== tempId));
    }

    pinPromotedFamily(pending: PendingFamily, newFid: string | undefined): void {
        if (!newFid || pending.x === undefined || pending.y === undefined) return;
        this.deps.getStemmaChart()?.setNodePosition(normalizeId("family", newFid), pending.x, pending.y);
    }

    attachPersonToFamily(
        personId: string,
        familyId: string,
        role: "parent" | "child",
        pinAt?: { x: number; y: number },
    ): void {
        const pending = this.findFamily(familyId);
        const chart = this.deps.getStemmaChart();
        if (pending) {
            if (familyHasPerson(pending, personId)) return;
            if (pinAt) chart?.setNodePosition(normalizeId("person", personId), pinAt.x, pinAt.y);
            const incoming: PersonDefinition = { type: "ExistingPerson", id: personId };
            this.promotePendingFamily(pending, incoming, role)
                .then((result) => {
                    this.clearPendingFamily(familyId);
                    this.pinPromotedFamily(pending, result.newFamilyIds[0]);
                })
                .catch(() => {});
            return;
        }
        const stemmaIndex = this.deps.getStemmaIndex();
        if (!stemmaIndex) return;
        const family = stemmaIndex.family(familyId);
        if (!family) return;
        if (familyHasPerson(family, personId)) return;
        if (pinAt) chart?.setNodePosition(normalizeId("person", personId), pinAt.x, pinAt.y);
        const incoming: PersonDefinition = { type: "ExistingPerson", id: personId };
        const { parents, children } = composeFamilyMembers(family.parents, family.children, incoming, role);
        this.deps.controller.updateFamily(familyId, parents, children, { silent: true }).catch(() => {});
    }

    createPersonInFamily(
        familyId: string,
        role: "parent" | "child",
        title: string,
        pinAt?: { x: number; y: number },
    ): void {
        const pending = this.findFamily(familyId);
        const stemmaIndex = this.deps.getStemmaIndex();
        if (!pending && !stemmaIndex?.family(familyId)) return;
        this.deps.getPersonEditModal()?.showCreatePerson({
            title,
            oncreate: ({ description, pin, photoUpload }) => {
                if (pending) {
                    void this.withPendingAdd(
                        description.name,
                        () => this.promotePendingFamily(pending, description, role),
                        pinAt,
                        (result) => {
                            this.clearPendingFamily(familyId);
                            this.pinPromotedFamily(pending, result.newFamilyIds[0]);
                            const newId = result.newPersonIds[0];
                            if (newId && (photoUpload || pin)) {
                                this.deps.controller.savePerson(newId, description, pin, photoUpload, false);
                            }
                        },
                    );
                    return;
                }
                const family = stemmaIndex?.family(familyId);
                if (!family) return;
                const { parents, children } = composeFamilyMembers(family.parents, family.children, description, role);
                void this.withPendingAdd(
                    description.name,
                    () => this.deps.controller.updateFamily(familyId, parents, children, { silent: true }),
                    pinAt,
                    (result) => {
                        const newId = result.newPersonIds[0];
                        if (newId && (photoUpload || pin)) {
                            this.deps.controller.savePerson(newId, description, pin, photoUpload, false);
                        }
                    },
                );
            },
        });
    }

    onGhostClick(
        kind: GhostKind,
        focused: FocusedId | null,
        ghostPos: { x: number; y: number },
    ): void {
        if (!focused) return;

        if (kind === "child" && focused.kind === "family") {
            this.createPersonInFamily(focused.id, "child", this.t("v3.addChild"), ghostPos);
            return;
        }

        const startBranchFromPerson = (
            personId: string,
            titleKey: string,
            pendingRole: "parent" | "child",
            promoteRole: "parent" | "child",
        ) => {
            this.deps.getPersonEditModal()?.showCreatePerson({
                title: this.t(titleKey),
                oncreate: ({ description, pin, photoUpload }) => {
                    const pending = this.createPendingFamilyForPerson(personId, pendingRole, ghostPos);
                    void this.withPendingAdd(
                        description.name,
                        () => this.promotePendingFamily(pending, description, promoteRole),
                        ghostPos,
                        (result) => {
                            this.clearPendingFamily(pending.tempId);
                            this.pinPromotedFamily(pending, result.newFamilyIds[0]);
                            const newId = result.newPersonIds[0];
                            if (newId && (photoUpload || pin)) {
                                this.deps.controller.savePerson(newId, description, pin, photoUpload, false);
                            }
                        },
                    );
                },
            });
        };

        if (focused.kind !== "person") return;
        if (kind === "child") startBranchFromPerson(focused.id, "v3.addChild", "parent", "child");
        else if (kind === "spouse") startBranchFromPerson(focused.id, "v3.addAnotherSpouse", "parent", "parent");
        else if (kind === "parent") startBranchFromPerson(focused.id, "v3.addParent", "child", "parent");
    }

    runRemovePerson(personId: string): void {
        this.deps.removedPersonIdsRef.set(setWith(this.deps.removedPersonIdsRef.get(), personId));
        this.deps.controller
            .removePerson(personId, { silent: true })
            .finally(() => {
                this.deps.removedPersonIdsRef.set(setWithout(this.deps.removedPersonIdsRef.get(), personId));
            });
    }

    runRemoveFamily(familyId: string): void {
        this.deps.removedFamilyIdsRef.set(setWith(this.deps.removedFamilyIdsRef.get(), familyId));
        this.deps.controller
            .removeFamily(familyId, { silent: true })
            .finally(() => {
                this.deps.removedFamilyIdsRef.set(setWithout(this.deps.removedFamilyIdsRef.get(), familyId));
            });
    }
}

function setWith<T>(s: Set<T>, v: T): Set<T> {
    return s.has(v) ? s : new Set([...s, v]);
}

function setWithout<T>(s: Set<T>, v: T): Set<T> {
    if (!s.has(v)) return s;
    const next = new Set(s);
    next.delete(v);
    return next;
}
