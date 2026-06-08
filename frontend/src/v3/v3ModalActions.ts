import { get } from "svelte/store";
import type { AppController } from "../appController";
import type { CreateNewPerson, StemmaDescription } from "../model";
import { t as tStore } from "../i18n";
import type { V3MutationActions } from "./v3MutationActions";

type PromptCfg = {
    title: string;
    label: string;
    confirmLabel: string;
    placeholder?: string;
    initial?: string;
    testid?: string;
    onaccept: (value: string) => void;
};
type ConfirmCfg = {
    title: string;
    message?: string;
    confirmLabel: string;
    danger?: boolean;
    testid?: string;
    onaccept: () => void;
};
type PromptModalRef = { prompt: (cfg: PromptCfg) => void } | null;
type ConfirmModalRef = { ask: (cfg: ConfirmCfg) => void } | null;
type PersonModalRef = {
    showCreatePerson: (cfg: {
        title: string;
        oncreate: (args: { description: CreateNewPerson; pin: boolean; photoUpload: Blob | null }) => void;
    }) => void;
    dismiss: () => void;
} | null;

export class V3ModalActions {
    constructor(
        private deps: {
            controller: AppController;
            actions: V3MutationActions;
            getPromptModal: () => PromptModalRef;
            getConfirmModal: () => ConfirmModalRef;
            getPersonModal: () => PersonModalRef;
        },
    ) {}

    private t(key: string, params?: Record<string, string>): string {
        return get(tStore)(key, params);
    }

    addStemma(): void {
        this.deps.getPromptModal()?.prompt({
            title: this.t("stemma.addTitle"),
            label: this.t("stemma.nameLabel"),
            confirmLabel: this.t("common.add"),
            placeholder: this.t("stemma.defaultName"),
            testid: "v3-add-stemma-modal",
            onaccept: (value) => this.deps.controller.addStemma(value),
        });
    }

    renameStemma(s: StemmaDescription): void {
        this.deps.getPromptModal()?.prompt({
            title: this.t("stemma.renameTitle"),
            label: this.t("stemma.nameLabel"),
            confirmLabel: this.t("stemma.rename"),
            initial: s.name,
            testid: "v3-rename-stemma-modal",
            onaccept: (value) => this.deps.controller.renameStemma(s.id, value),
        });
    }

    cloneStemma(s: StemmaDescription): void {
        this.deps.getPromptModal()?.prompt({
            title: this.t("stemma.cloneTitle"),
            label: this.t("stemma.nameLabel"),
            confirmLabel: this.t("stemma.clone"),
            initial: s.name,
            testid: "v3-clone-stemma-modal",
            onaccept: (value) => this.deps.controller.cloneStemma(value, s.id),
        });
    }

    removeStemma(s: StemmaDescription): void {
        this.deps.getConfirmModal()?.ask({
            title: this.t("removeStemma.title", { name: s.name }),
            confirmLabel: this.t("common.delete"),
            danger: true,
            testid: "v3-remove-stemma-modal",
            onaccept: () => this.deps.controller.removeStemma(s.id),
        });
    }

    addPerson(): void {
        this.deps.getPersonModal()?.showCreatePerson({
            title: this.t("v2.addPerson"),
            oncreate: ({ description, pin, photoUpload }) => {
                void this.deps.actions.withPendingAdd(
                    description.name,
                    () => this.deps.controller.createOrphanPerson(description, { silent: true }),
                    undefined,
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

    confirmRemoveFamily(familyId: string): void {
        this.deps.getConfirmModal()?.ask({
            title: this.t("v2.removeFamilyTitle"),
            message: this.t("v2.removeFamilyMessage"),
            confirmLabel: this.t("v2.dissolveFamilyConfirm"),
            danger: true,
            testid: "v3-remove-family-modal",
            onaccept: () => this.deps.actions.runRemoveFamily(familyId),
        });
    }

    confirmRemovePerson(payload: { id: string; name: string }): void {
        this.deps.getConfirmModal()?.ask({
            title: this.t("v2.removePersonTitle", { name: payload.name }),
            message: this.t("v2.removePersonMessage"),
            confirmLabel: this.t("common.delete"),
            danger: true,
            testid: "v3-remove-person-modal",
            onaccept: () => {
                this.deps.actions.runRemovePerson(payload.id);
                this.deps.getPersonModal()?.dismiss();
            },
        });
    }
}
