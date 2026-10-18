<script lang="ts">
    import { t } from "../i18n";
    import type { LinkOption } from "../ghostLink";
    import type { StemmaIndex } from "../stemmaIndex";
    import { personDisplayName } from "../personDisplayName";

    /** Link mode: how to link the two people a drag connected (only valid links are offered). */
    type Props = {
        options: LinkOption[];
        index: StemmaIndex;
        x: number;
        y: number;
        onpick: (option: LinkOption) => void;
        oncancel: () => void;
    };

    let { options, index, x, y, onpick, oncancel }: Props = $props();

    const nameOf = (id: string) => personDisplayName(index.person(id)?.name ?? null);

    function joinNames(ids: string[]): string {
        const names = ids.map(nameOf);
        return names.length <= 1 ? (names[0] ?? "") : names.slice(0, -1).join(", ") + $t("link.and") + names[names.length - 1];
    }

    function label(o: LinkOption): string {
        if (o.kind === "spouses") return $t("link.spouses", { a: nameOf(o.a), b: nameOf(o.b) });
        const parents = o.familyId ? (index.family(o.familyId)?.parents ?? [o.parentId]) : [o.parentId];
        return $t("link.childOf", { child: nameOf(o.childId), parents: joinNames(parents) });
    }

    // keep the menu on screen
    const left = $derived(Math.max(8, Math.min(x + 12, window.innerWidth - 300)));
    const top = $derived(Math.max(8, Math.min(y + 12, window.innerHeight - 60 - options.length * 40)));

    $effect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") oncancel();
        };
        const onDown = (e: PointerEvent) => {
            if (!(e.target as Element | null)?.closest?.(".link-picker")) oncancel();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("pointerdown", onDown, true);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("pointerdown", onDown, true);
        };
    });
</script>

<div class="link-picker" style="left: {left}px; top: {top}px;" role="menu" data-testid="link-picker">
    {#each options as o, i (i)}
        <button type="button" class="link-option" role="menuitem" onclick={() => onpick(o)} data-testid="link-option">
            <i class="bi {o.kind === 'spouses' ? 'bi-heart' : 'bi-diagram-2'}"></i>
            {label(o)}
        </button>
    {/each}
    <button type="button" class="link-option cancel" onclick={oncancel}>{$t("common.cancel")}</button>
</div>

<style>
    .link-picker {
        position: fixed;
        z-index: 1200;
        min-width: 220px;
        max-width: 300px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
        padding: 4px;
        display: flex;
        flex-direction: column;
    }
    .link-option {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: none;
        background: none;
        border-radius: 8px;
        text-align: left;
        font-size: 0.9rem;
        cursor: pointer;
    }
    .link-option:hover,
    .link-option:focus-visible {
        background: #eef4ff;
    }
    .link-option .bi {
        color: #0d6efd;
    }
    .link-option.cancel {
        color: #6c757d;
        justify-content: center;
    }
</style>
