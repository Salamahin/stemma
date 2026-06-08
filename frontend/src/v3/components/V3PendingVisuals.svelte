<script lang="ts">
    import { normalizeId } from "../../graphTools";
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
        svgEl.querySelectorAll("circle.v3-pending-remove, circle.v3-pending-add").forEach((el) => {
            el.classList.remove("v3-pending-remove", "v3-pending-add");
        });
        const markCircle = (nodeId: string, cls: string) => {
            const el = document.getElementById(nodeId);
            const circle = el?.querySelector("circle");
            if (circle) circle.classList.add(cls);
        };
        removedPersonIds.forEach((id) => markCircle(normalizeId("person", id), "v3-pending-remove"));
        removedFamilyIds.forEach((id) => markCircle(normalizeId("family", id), "v3-pending-remove"));
        adds.forEach((p) => markCircle(normalizeId("person", p.tempId), "v3-pending-add"));
        families.forEach((p) => markCircle(normalizeId("family", p.tempId), "v3-pending-add"));
    }
</script>

<style>
    :global(.v3-pending-remove) {
        stroke-dasharray: 4 4;
        stroke: #dc3545;
        opacity: 0.45;
        animation: v3-pending-pulse 1.2s ease-in-out infinite;
    }

    :global(.v3-pending-add) {
        opacity: 0.45;
        stroke-dasharray: 4 3;
        stroke: #0d6efd;
        animation: v3-pending-pulse 1.2s ease-in-out infinite;
    }

    @keyframes v3-pending-pulse {
        0%, 100% { stroke-opacity: 1; }
        50% { stroke-opacity: 0.35; }
    }
</style>
