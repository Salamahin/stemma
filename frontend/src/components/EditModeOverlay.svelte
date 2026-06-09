<script lang="ts">
    import { t } from "../i18n";

    type Props = { editMode: boolean };
    let { editMode }: Props = $props();
</script>

{#if editMode}
    <svg class="edit-watermark" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <pattern id="edit-watermark-pattern" patternUnits="userSpaceOnUse" width="360" height="140" patternTransform="rotate(-25)">
                <text x="0" y="60" fill="#212529" font-size="42" font-weight="800" letter-spacing="6">{$t("editModeBanner")}</text>
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#-edit-watermark-pattern)" />
    </svg>
{/if}

<style>
    .edit-watermark {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        opacity: 0.04;
    }

    :global(.edit-mode) {
        box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.55);
        animation: -edit-mode-ring-pulse 2.4s ease-in-out infinite;
    }

    @keyframes -edit-mode-ring-pulse {
        0%, 100% { box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.55); }
        50% { box-shadow: inset 0 0 0 3px rgba(73, 80, 87, 0.22); }
    }

    :global(.edit-mode::before) {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        opacity: 0.08;
        background-repeat: repeat;
        background-size: 220px 220px;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'><g fill='%23212529'><g transform='translate(30 40) rotate(20) scale(1.4)'><path d='M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325'/></g><g transform='translate(150 90) rotate(-35) scale(1.6)'><path d='M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325'/></g><g transform='translate(80 170) rotate(75) scale(1.3)'><path d='M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325'/></g></g></svg>");
    }
</style>
