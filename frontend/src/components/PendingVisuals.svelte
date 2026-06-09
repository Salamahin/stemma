<script lang="ts">
    import { normalizeId } from "../graphTools";
    import type { PendingAdd, PendingFamily } from "../pendingState";

    type Props = {
        adds: PendingAdd[];
        families: PendingFamily[];
        removedPersonIds: Set<string>;
        removedFamilyIds: Set<string>;
        stemmaChartReady: boolean;
    };

    let { adds, families, removedPersonIds, removedFamilyIds, stemmaChartReady }: Props = $props();

    $effect(() => {
        if (!stemmaChartReady) return;
        void adds;
        void families;
        void removedPersonIds;
        void removedFamilyIds;
        queueMicrotask(applyPendingClasses);
    });

    function applyPendingClasses() {
        const svgEl = document.getElementById("chart");
        if (!svgEl) return;
        svgEl.querySelectorAll("circle.pending-remove, circle.pending-add").forEach((el) => {
            el.classList.remove("pending-remove", "pending-add");
        });
        const markCircle = (nodeId: string, cls: string) => {
            const el = document.getElementById(nodeId);
            const circle = el?.querySelector("circle");
            if (circle) circle.classList.add(cls);
        };
        removedPersonIds.forEach((id) => markCircle(normalizeId("person", id), "pending-remove"));
        removedFamilyIds.forEach((id) => markCircle(normalizeId("family", id), "pending-remove"));
        adds.forEach((p) => markCircle(normalizeId("person", p.tempId), "pending-add"));
        families.forEach((p) => markCircle(normalizeId("family", p.tempId), "pending-add"));
    }
</script>

<style>
    :global(.pending-remove) {
        stroke-dasharray: 4 4;
        stroke: #dc3545;
        opacity: 0.45;
        animation: -pending-pulse 1.2s ease-in-out infinite;
    }

    :global(.pending-add) {
        opacity: 0.45;
        stroke-dasharray: 4 3;
        stroke: #0d6efd;
        animation: -pending-pulse 1.2s ease-in-out infinite;
    }

    @keyframes -pending-pulse {
        0%, 100% { stroke-opacity: 1; }
        50% { stroke-opacity: 0.35; }
    }
</style>
