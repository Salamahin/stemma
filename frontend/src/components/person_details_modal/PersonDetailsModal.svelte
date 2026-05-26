<script module lang="ts">
    import type { PersonDescription, CreateNewPerson } from "../../model";
    import { imask } from "@imask/svelte";

    export type UpdatePerson = {
        id: string;
        pin: boolean;
        description: CreateNewPerson;
        photoUpload: Blob | null;
        photoRemove: boolean;
    };

    export type ShowPerson = {
        pin: boolean;
        description: PersonDescription;
    };

    const CROP_OUTPUT_SIZE = 512;
    const CROP_MAX_ZOOM = 4;
    const CROP_OUTPUT_MIME = "image/jpeg";
    const CROP_OUTPUT_QUALITY = 0.9;

    export function clampCropOffset(
        dx: number,
        dy: number,
        imgW: number,
        imgH: number,
        containerSize: number,
    ): { dx: number; dy: number } {
        const minDx = containerSize - imgW;
        const minDy = containerSize - imgH;
        const clampedDx = imgW <= containerSize ? (containerSize - imgW) / 2 : Math.min(0, Math.max(minDx, dx));
        const clampedDy = imgH <= containerSize ? (containerSize - imgH) / 2 : Math.min(0, Math.max(minDy, dy));
        return { dx: clampedDx, dy: clampedDy };
    }

    export function coverBaseScale(naturalW: number, naturalH: number, containerSize: number): number {
        return Math.max(containerSize / naturalW, containerSize / naturalH);
    }

    const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
</script>

<script lang="ts">
    import * as bootstrap from "bootstrap";
    import { t } from "../../i18n";

    type Props = {
        onpersonUpdated?: (payload: UpdatePerson) => void;
        onpersonRemoved?: (id: string) => void;
    };

    let { onpersonUpdated, onpersonRemoved }: Props = $props();

    let modalEl = $state<HTMLElement>(null);
    let birthInputEl = $state<HTMLInputElement>(null);
    let deathInputEl = $state<HTMLInputElement>(null);
    let photoFileInputEl = $state<HTMLInputElement>(null);

    let pinned = $state<boolean>(false);
    let name = $state<string>("");
    let birthDate = $state<Date>(null);
    let deathDate = $state<Date>(null);
    let bio = $state<string>("");
    let id = $state<string>("");
    let readOnly = $state<boolean>(false);
    let photoUrl = $state<string | null>(null);
    let photoErrString = $state<string | null>(null);
    let originalPhotoUrl: string | null = null;
    let pendingPhotoBlob = $state<Blob | null>(null);
    let pendingPhotoPreviewUrl = $state<string | null>(null);
    let pendingPhotoRemove = $state<boolean>(false);

    let cropImageEl = $state<HTMLImageElement>(null);
    let cropContainerEl = $state<HTMLElement>(null);
    let cropping = $state<boolean>(false);
    let cropImageUrl = $state<string | null>(null);
    let cropBaseScale = $state<number>(1);
    let cropScale = $state<number>(1);
    let cropDx = $state<number>(0);
    let cropDy = $state<number>(0);
    let cropNaturalW = $state<number>(0);
    let cropNaturalH = $state<number>(0);
    let cropImageReady = $state<boolean>(false);
    let dragOrigin: { x: number; y: number; dx: number; dy: number } | null = null;

    let birthDateErrString = $state<string>(null);
    let deathDateErrString = $state<string>(null);

    function personUpdated() {
        onpersonUpdated?.({
            id,
            description: {
                type: "CreateNewPerson",
                name,
                birthDate: dateToIsoLocalTime(birthDate),
                deathDate: dateToIsoLocalTime(deathDate),
                bio,
            },
            pin: pinned,
            photoUpload: pendingPhotoBlob,
            photoRemove: pendingPhotoRemove,
        });

        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function personRemoved() {
        onpersonRemoved?.(id);
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    function dateToIsoLocalTime(d: Date) {
        if (!d) return null;

        const date = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();

        const dateStr = date < 10 ? "0" + date : date.toString();
        const monthStr = month < 10 ? "0" + month : month.toString();

        return `${year}-${monthStr}-${dateStr}`;
    }

    export function showPersonDetails(p: ShowPerson) {
        id = p.description.id;
        name = p.description.name;
        birthDate = p.description.birthDate ? new Date(p.description.birthDate) : null;
        deathDate = p.description.deathDate ? new Date(p.description.deathDate) : null;
        if (birthInputEl) birthInputEl.value = dateToMaskedDateStr(birthDate) ?? "";
        if (deathInputEl) deathInputEl.value = dateToMaskedDateStr(deathDate) ?? "";
        bio = p.description.bio;
        pinned = p.pin;
        readOnly = p.description.readOnly;
        originalPhotoUrl = p.description.photoUrl ?? null;
        photoUrl = originalPhotoUrl;
        photoErrString = null;
        if (photoFileInputEl) photoFileInputEl.value = "";
        resetCropState();
        resetPendingPhoto();

        birthDateErrString = null;
        deathDateErrString = null;

        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    function resetPendingPhoto() {
        if (pendingPhotoPreviewUrl) URL.revokeObjectURL(pendingPhotoPreviewUrl);
        pendingPhotoPreviewUrl = null;
        pendingPhotoBlob = null;
        pendingPhotoRemove = false;
    }

    function resetCropState() {
        if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
        cropImageUrl = null;
        cropping = false;
        cropImageReady = false;
        cropScale = 1;
        cropBaseScale = 1;
        cropDx = 0;
        cropDy = 0;
        cropNaturalW = 0;
        cropNaturalH = 0;
        dragOrigin = null;
    }

    function pickPhoto() {
        photoErrString = null;
        photoFileInputEl?.click();
    }

    function onPhotoFileChange(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files && input.files[0];
        if (!file) return;
        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
            photoErrString = $t("person.photoUnsupportedType");
            input.value = "";
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            photoErrString = $t("person.photoTooLarge");
            input.value = "";
            return;
        }
        photoErrString = null;
        if (cropImageUrl) URL.revokeObjectURL(cropImageUrl);
        cropImageUrl = URL.createObjectURL(file);
        cropImageReady = false;
        cropping = true;
        input.value = "";
    }

    function onCropImageLoaded() {
        if (!cropImageEl || !cropContainerEl) return;
        cropNaturalW = cropImageEl.naturalWidth;
        cropNaturalH = cropImageEl.naturalHeight;
        const containerSize = cropContainerEl.clientWidth;
        cropBaseScale = coverBaseScale(cropNaturalW, cropNaturalH, containerSize);
        cropScale = 1;
        const imgW = cropNaturalW * cropBaseScale;
        const imgH = cropNaturalH * cropBaseScale;
        cropDx = (containerSize - imgW) / 2;
        cropDy = (containerSize - imgH) / 2;
        cropImageReady = true;
    }

    function reclampCropOffset() {
        if (!cropContainerEl) return;
        const containerSize = cropContainerEl.clientWidth;
        const total = cropBaseScale * cropScale;
        const imgW = cropNaturalW * total;
        const imgH = cropNaturalH * total;
        const clamped = clampCropOffset(cropDx, cropDy, imgW, imgH, containerSize);
        cropDx = clamped.dx;
        cropDy = clamped.dy;
    }

    function onCropScaleChange() {
        reclampCropOffset();
    }

    function onCropPointerDown(event: PointerEvent) {
        if (!cropImageReady) return;
        const target = event.currentTarget as HTMLElement;
        target.setPointerCapture(event.pointerId);
        dragOrigin = { x: event.clientX, y: event.clientY, dx: cropDx, dy: cropDy };
        event.preventDefault();
    }

    function onCropPointerMove(event: PointerEvent) {
        if (!dragOrigin) return;
        const nextDx = dragOrigin.dx + (event.clientX - dragOrigin.x);
        const nextDy = dragOrigin.dy + (event.clientY - dragOrigin.y);
        const containerSize = cropContainerEl?.clientWidth ?? 0;
        const total = cropBaseScale * cropScale;
        const imgW = cropNaturalW * total;
        const imgH = cropNaturalH * total;
        const clamped = clampCropOffset(nextDx, nextDy, imgW, imgH, containerSize);
        cropDx = clamped.dx;
        cropDy = clamped.dy;
    }

    function onCropPointerUp(event: PointerEvent) {
        if (!dragOrigin) return;
        const target = event.currentTarget as HTMLElement;
        if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
        dragOrigin = null;
    }

    function onCropWheel(event: WheelEvent) {
        if (!cropImageReady) return;
        event.preventDefault();
        const delta = -event.deltaY * 0.002;
        const nextScale = Math.min(CROP_MAX_ZOOM, Math.max(1, cropScale + delta));
        if (nextScale === cropScale) return;
        cropScale = nextScale;
        reclampCropOffset();
    }

    function cancelCrop() {
        resetCropState();
    }

    function confirmCrop() {
        if (!cropImageEl || !cropContainerEl || !cropImageReady) return;
        const containerSize = cropContainerEl.clientWidth;
        const total = cropBaseScale * cropScale;
        const sx = -cropDx / total;
        const sy = -cropDy / total;
        const ss = containerSize / total;
        const canvas = document.createElement("canvas");
        canvas.width = CROP_OUTPUT_SIZE;
        canvas.height = CROP_OUTPUT_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(cropImageEl, sx, sy, ss, ss, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    photoErrString = $t("person.photoUploadFailed");
                    return;
                }
                if (pendingPhotoPreviewUrl) URL.revokeObjectURL(pendingPhotoPreviewUrl);
                pendingPhotoBlob = blob;
                pendingPhotoPreviewUrl = URL.createObjectURL(blob);
                pendingPhotoRemove = false;
                photoUrl = pendingPhotoPreviewUrl;
                resetCropState();
            },
            CROP_OUTPUT_MIME,
            CROP_OUTPUT_QUALITY,
        );
    }

    function removePhoto() {
        photoErrString = null;
        if (pendingPhotoBlob) {
            if (pendingPhotoPreviewUrl) URL.revokeObjectURL(pendingPhotoPreviewUrl);
            pendingPhotoPreviewUrl = null;
            pendingPhotoBlob = null;
            photoUrl = originalPhotoUrl;
            return;
        }
        if (originalPhotoUrl) {
            pendingPhotoRemove = true;
            photoUrl = null;
        }
    }

    function parseMaskedDateStr(str: string) {
        const [day, month, year] = str.split(".");
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    function dateToMaskedDateStr(date: Date) {
        if (!date) return null;

        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const dayStr = day < 10 ? "0" + day : day.toString();
        const monthStr = month < 10 ? "0" + month : month.toString();

        return [dayStr, monthStr, year.toString()].join(".");
    }

    const dateMaskingOpts = {
        mask: Date,
        lazy: true,
        max: new Date(),
        format: dateToMaskedDateStr,
        parse: parseMaskedDateStr,
    };

    function attachMaskedDateListeners(
        el: HTMLInputElement,
        setErr: (err: string | null) => void,
        setDate: (d: Date) => void,
    ) {
        function onAccept(e: Event) {
            const maskRef = (e as CustomEvent).detail;
            setErr(maskRef.unmaskedValue ? $t("person.incompleteDate") : null);
        }
        function onComplete(e: Event) {
            const maskRef = (e as CustomEvent).detail;
            setErr(null);
            setDate(parseMaskedDateStr(maskRef.value));
            validateLifetimeRange();
        }
        el.addEventListener("accept", onAccept);
        el.addEventListener("complete", onComplete);
        return () => {
            el.removeEventListener("accept", onAccept);
            el.removeEventListener("complete", onComplete);
        };
    }

    $effect(() => {
        if (!birthInputEl) return;
        return attachMaskedDateListeners(
            birthInputEl,
            (err) => (birthDateErrString = err),
            (d) => (birthDate = d),
        );
    });

    $effect(() => {
        if (!deathInputEl) return;
        return attachMaskedDateListeners(
            deathInputEl,
            (err) => (deathDateErrString = err),
            (d) => (deathDate = d),
        );
    });

    function validateLifetimeRange() {
        if (!birthDate || !deathDate) return;

        if (deathDate < birthDate) {
            birthDateErrString = $t("person.invalidDateRange");
            deathDateErrString = $t("person.invalidDateRange");
        } else {
            birthDateErrString = null;
            deathDateErrString = null;
        }
    }
</script>

<div class="modal fade" id="personDetailsModal" tabindex="-1" aria-hidden="true" bind:this={modalEl}>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-fullscreen-lg-down">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title ms-2" id="addFamlilyLabel">
                    {cropping ? $t("person.photoAdjustTitle") : $t("person.title")}
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                {#if cropping}
                    <div class="d-flex flex-column align-items-stretch gap-3">
                        <div
                            bind:this={cropContainerEl}
                            class="person-photo-crop-area"
                            role="application"
                            aria-label={$t("person.photoAdjustHint")}
                            onpointerdown={onCropPointerDown}
                            onpointermove={onCropPointerMove}
                            onpointerup={onCropPointerUp}
                            onpointercancel={onCropPointerUp}
                            onwheel={onCropWheel}
                        >
                            {#if cropImageUrl}
                                <img
                                    bind:this={cropImageEl}
                                    src={cropImageUrl}
                                    alt=""
                                    class="person-photo-crop-image"
                                    style="transform: translate({cropDx}px, {cropDy}px) scale({cropBaseScale * cropScale}); visibility: {cropImageReady ? 'visible' : 'hidden'};"
                                    onload={onCropImageLoaded}
                                    draggable="false"
                                />
                            {/if}
                            <div class="person-photo-crop-overlay"></div>
                        </div>
                        <input
                            type="range"
                            class="form-range"
                            min="1"
                            max={CROP_MAX_ZOOM}
                            step="0.01"
                            bind:value={cropScale}
                            oninput={onCropScaleChange}
                            disabled={!cropImageReady}
                            aria-label={$t("person.photoAdjustHint")}
                        />
                        <div class="text-muted small">{$t("person.photoAdjustHint")}</div>
                    </div>
                {:else}
                <form class="row g-3">
                    <div class="col-md-4">
                        <div class="person-photo-frame">
                            {#if photoUrl}
                                <img src={photoUrl} alt={name} class="person-photo-image" />
                            {:else}
                                <div class="person-photo-empty d-flex align-items-center justify-content-center text-muted">
                                    {$t("person.photo")}
                                </div>
                            {/if}
                            {#if !readOnly}
                                <button
                                    type="button"
                                    class="person-photo-upload-btn"
                                    onclick={pickPhoto}
                                    aria-label={photoUrl ? $t("person.photoReplace") : $t("person.photoUpload")}
                                >
                                    <span class="person-photo-upload-label">
                                        {photoUrl ? $t("person.photoReplace") : $t("person.photoUpload")}
                                    </span>
                                </button>
                                <input
                                    bind:this={photoFileInputEl}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    class="d-none"
                                    onchange={onPhotoFileChange}
                                />
                            {/if}
                        </div>
                        {#if !readOnly && photoUrl}
                            <button type="button" class="btn btn-outline-danger btn-sm w-100 mt-2" onclick={removePhoto}>
                                {$t("person.photoRemove")}
                            </button>
                        {/if}
                        {#if photoErrString}
                            <div class="text-danger mt-2 small">{photoErrString}</div>
                        {/if}
                    </div>
                    <div class="col-md-8">
                        <div class="mb-3">
                            <label for="personNameInput" class="form-label">{$t("person.name")}</label>
                            <input class="form-control" id="personNameInput" aria-describedby="personNameHelp" bind:value={name} readonly={readOnly} />
                        </div>
                        <div class="form-label">{$t("person.lifeYears")}</div>
                        <div class="row g-2">
                            <div class="col-6">
                                <input
                                    bind:this={birthInputEl}
                                    id="birthDateInput"
                                    value={dateToMaskedDateStr(birthDate)}
                                    use:imask={dateMaskingOpts}
                                    class="form-control birthdate-input {birthDateErrString ? 'is-invalid' : ''}"
                                    readonly={readOnly}
                                    placeholder={$t("person.datePlaceholder")}
                                />
                                <div class="invalid-feedback">{birthDateErrString}</div>
                            </div>
                            <div class="col-6">
                                <input
                                    bind:this={deathInputEl}
                                    id="deathDateInput"
                                    value={dateToMaskedDateStr(deathDate)}
                                    use:imask={dateMaskingOpts}
                                    class="form-control deathdate-input {deathDateErrString ? 'is-invalid' : ''}"
                                    readonly={readOnly}
                                    placeholder={$t("person.datePlaceholder")}
                                />
                                <div class="invalid-feedback">{deathDateErrString}</div>
                            </div>
                        </div>
                    </div>

                    <div class="col-12">
                        <label for="personBioInput" class="form-label">{$t("person.bio")}</label>
                        <textarea class="form-control" rows="6" id="personBioInput" bind:value={bio} readonly={readOnly}></textarea>
                    </div>
                    <div class="col-12">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="flexSwitchCheckDefault" bind:checked={pinned} />
                            <label class="form-check-label" for="flexSwitchCheckDefault">{$t("person.pin")}</label>
                        </div>
                    </div>
                </form>
                {/if}
            </div>
            <div class="modal-footer">
                {#if cropping}
                    <button type="button" class="btn btn-secondary" onclick={cancelCrop}>{$t("common.cancel")}</button>
                    <button type="button" class="btn btn-primary" disabled={!cropImageReady} onclick={confirmCrop}>
                        {$t("common.save")}
                    </button>
                {:else}
                    {#if !readOnly}
                        <button type="button" class="btn btn-danger me-auto" onclick={personRemoved}>{$t("common.delete")}</button>
                    {/if}
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{$t("common.cancel")}</button>
                    <button
                        type="button"
                        class="btn btn-primary"
                        disabled={birthDateErrString != null || deathDateErrString != null}
                        onclick={personUpdated}>{$t("common.save")}</button
                    >
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .person-photo-frame {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 0.375rem;
        overflow: hidden;
        border: 1px solid var(--bs-border-color, #dee2e6);
        background-color: var(--bs-light, #f8f9fa);
    }
    .person-photo-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
    .person-photo-empty {
        width: 100%;
        height: 100%;
        font-size: 0.875rem;
    }
    .person-photo-upload-btn {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        transition: background-color 0.15s ease-in-out;
    }
    .person-photo-upload-btn:hover,
    .person-photo-upload-btn:focus-visible {
        background-color: rgba(0, 0, 0, 0.35);
    }
    .person-photo-upload-label {
        width: 100%;
        padding: 0.5rem;
        background-color: rgba(0, 0, 0, 0.55);
        color: #fff;
        font-size: 0.875rem;
        text-align: center;
        opacity: 0;
        transition: opacity 0.15s ease-in-out;
    }
    .person-photo-frame:has(.person-photo-empty) .person-photo-upload-label,
    .person-photo-upload-btn:hover .person-photo-upload-label,
    .person-photo-upload-btn:focus-visible .person-photo-upload-label {
        opacity: 1;
    }
    .person-photo-crop-area {
        position: relative;
        width: 100%;
        max-width: 400px;
        aspect-ratio: 1 / 1;
        margin: 0 auto;
        border-radius: 0.375rem;
        overflow: hidden;
        background-color: #000;
        cursor: grab;
        touch-action: none;
        user-select: none;
    }
    .person-photo-crop-area:active {
        cursor: grabbing;
    }
    .person-photo-crop-image {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        pointer-events: none;
        max-width: none;
    }
    .person-photo-crop-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
    }
</style>
