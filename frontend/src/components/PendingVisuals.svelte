<script lang="ts">
    import { normalizeId } from "../graphTools";
    import type { PendingAdd, PendingFamily } from "../pendingState";
    import type { CanvasChart } from "../canvasChart";

    type Props = {
        adds: PendingAdd[];
        families: PendingFamily[];
        removedPersonIds: Set<string>;
        removedFamilyIds: Set<string>;
        chart: CanvasChart | null;
    };

    let { adds, families, removedPersonIds, removedFamilyIds, chart }: Props = $props();

    // Pending-add nodes are drawn translucent with a dashed, pulsing blue
    // outline; pending-remove ones with a dashed red outline (canvasChart).
    $effect(() => {
        if (!chart) return;
        const remove: string[] = [];
        const add: string[] = [];
        removedPersonIds.forEach((id) => remove.push(normalizeId("person", id)));
        removedFamilyIds.forEach((id) => remove.push(normalizeId("family", id)));
        adds.forEach((p) => add.push(normalizeId("person", p.tempId)));
        families.forEach((p) => add.push(normalizeId("family", p.tempId)));
        chart.setPendingMarks(add, remove);
    });
</script>
