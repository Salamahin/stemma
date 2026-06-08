<script lang="ts">
    import type { PersonDescription } from "../../model";
    import { t } from "../../i18n";

    type Props = {
        orphans: PersonDescription[];
        busy: boolean;
        open: boolean;
        onbulkAdd: (names: string[]) => void;
        ontoggle: () => void;
    };

    let { orphans, busy, open, onbulkAdd, ontoggle }: Props = $props();

    let draft = $state("");

    function submit() {
        const names = draft
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (!names.length) return;
        onbulkAdd(names);
        draft = "";
    }

    function handleDragStart(event: DragEvent, personId: string) {
        if (!event.dataTransfer) return;
        event.dataTransfer.effectAllowed = "link";
        event.dataTransfer.setData("application/x-stemma-person", personId);
        event.dataTransfer.setData("text/plain", personId);
    }
</script>

<aside
    class="v3-tray"
    class:open
    data-testid="v3-bulk-add-tray"
>
    <button
        type="button"
        class="tray-toggle"
        onclick={ontoggle}
        aria-label={open ? $t("v2.tray.close") : $t("v2.tray.open")}
        data-testid="v3-tray-toggle"
    >
        {open ? "›" : "‹"}
    </button>
    {#if open}
        <div class="tray-body">
            <div class="tray-title">{$t("v2.tray.title")}</div>
            <textarea
                class="form-control tray-textarea"
                rows="4"
                placeholder={$t("v2.tray.placeholder")}
                bind:value={draft}
                disabled={busy}
                data-testid="v3-tray-textarea"
            ></textarea>
            <button
                type="button"
                class="btn btn-primary btn-sm tray-add"
                onclick={submit}
                disabled={busy || draft.trim().length === 0}
                data-testid="v3-tray-add-all"
            >
                {$t("v2.tray.addAll")}
            </button>
            <div class="tray-chips" data-testid="v3-tray-chips">
                {#each orphans as person (person.id)}
                    <div
                        class="tray-chip"
                        role="button"
                        tabindex="0"
                        draggable="true"
                        ondragstart={(e) => handleDragStart(e, person.id)}
                        data-testid={`v3-tray-chip-${person.id}`}
                        title={$t("v2.tray.dragHint")}
                    >
                        {person.name}
                    </div>
                {/each}
                {#if orphans.length === 0}
                    <div class="tray-empty">{$t("v2.tray.empty")}</div>
                {/if}
            </div>
        </div>
    {/if}
</aside>

<style>
    .v3-tray {
        position: absolute;
        top: 72px;
        right: 16px;
        bottom: 90px;
        width: 260px;
        max-width: calc(100vw - 32px);
        background: var(--v3-bg-surface);
        border: 1px solid var(--v3-border-subtle);
        border-radius: var(--v3-radius-modal);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        z-index: 105;
        transition: transform 0.18s ease;
        transform: translateX(calc(100% + 24px));
    }
    .v3-tray.open {
        transform: translateX(0);
    }

    .tray-toggle {
        position: absolute;
        top: 16px;
        left: -36px;
        width: 32px;
        height: 32px;
        border: 1px solid var(--v3-border-subtle);
        background: var(--v3-bg-surface);
        border-radius: 16px;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        font-size: 1.1rem;
        line-height: 1;
    }

    .tray-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        height: 100%;
        overflow: hidden;
    }

    .tray-title {
        font-weight: var(--v3-fw-section);
        font-size: var(--v3-fs-body);
    }

    .tray-textarea {
        resize: vertical;
        font-size: var(--v3-fs-body);
    }

    .tray-add {
        align-self: flex-end;
    }

    .tray-chips {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 6px;
        border-top: 1px solid var(--v3-border-subtle);
    }

    .tray-chip {
        padding: 6px 10px;
        border: 1px solid #d0d7de;
        border-radius: 14px;
        background: #f6f8fa;
        cursor: grab;
        user-select: none;
        font-size: var(--v3-fs-body);
    }
    .tray-chip:active {
        cursor: grabbing;
    }

    .tray-empty {
        color: var(--v3-text-muted);
        font-size: var(--v3-fs-hint);
        text-align: center;
        padding: 12px 0;
    }
</style>
