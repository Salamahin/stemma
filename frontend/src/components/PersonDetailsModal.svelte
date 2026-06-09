<script module lang="ts">
    import type { PersonDescription, CreateNewPerson as CreateNewPersonType } from "../model";

    export type UpdatePerson = {
        id: string;
        pin: boolean;
        description: CreateNewPersonType;
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
    const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

    function clampCropOffset(
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

    function coverBaseScale(naturalW: number, naturalH: number, containerSize: number): number {
        return Math.max(containerSize / naturalW, containerSize / naturalH);
    }
</script>

<script lang="ts">
    import { imask } from "@imask/svelte";
    import { t } from "../i18n";
    import { renderBioMarkdown } from "../bioMarkdown";
    import { isUnknownPerson } from "../personDisplayName";
    import type { CreateNewPerson } from "../model";
    import Modal from "./Modal.svelte";

    export type CreatePersonPayload = {
        description: CreateNewPerson;
        pin: boolean;
        photoUpload: Blob | null;
    };

    type Props = {
        editMode?: boolean;
        onpersonUpdated?: (payload: UpdatePerson) => void;
        onpersonRemoveRequested?: (payload: { id: string; name: string }) => void;
        onshareAccessRequested?: (payload: { personId: string; name: string }) => void;
    };

    let {
        editMode = false,
        onpersonUpdated,
        onpersonRemoveRequested,
        onshareAccessRequested,
    }: Props = $props();

    let open = $state(false);
    let mode = $state<"view" | "create">("view");
    let createTitle = $state<string | null>(null);
    let activeCreateCallback: ((payload: CreatePersonPayload) => void) | null = null;
    const isCreate = $derived(mode === "create");
    let birthInputEl = $state<HTMLInputElement | null>(null);
    let deathInputEl = $state<HTMLInputElement | null>(null);
    let photoFileInputEl = $state<HTMLInputElement | null>(null);

    let pinned = $state(false);
    let unknown = $state(false);
    let name = $state("");
    let birthDate = $state<Date | null>(null);
    let deathDate = $state<Date | null>(null);
    let bio = $state("");
    let id = $state("");
    let personReadOnly = $state(false);
    const editingAllowed = $derived(isCreate || (editMode && !personReadOnly));
    const readOnly = $derived(!editingAllowed);
    let photoUrl = $state<string | null>(null);
    let photoErrString = $state<string | null>(null);
    let originalPhotoUrl: string | null = null;
    let pendingPhotoBlob = $state<Blob | null>(null);
    let pendingPhotoPreviewUrl = $state<string | null>(null);
    let pendingPhotoRemove = $state(false);

    let cropImageEl = $state<HTMLImageElement | null>(null);
    let cropContainerEl = $state<HTMLElement | null>(null);
    let cropping = $state(false);
    let cropImageUrl = $state<string | null>(null);
    let cropBaseScale = $state(1);
    let cropScale = $state(1);
    let cropDx = $state(0);
    let cropDy = $state(0);
    let cropNaturalW = $state(0);
    let cropNaturalH = $state(0);
    let cropImageReady = $state(false);
    let dragOrigin: { x: number; y: number; dx: number; dy: number } | null = null;

    let birthDateErrString = $state<string | null>(null);
    let deathDateErrString = $state<string | null>(null);

    let bioTab = $state<"edit" | "preview">("preview");
    const bioHtml = $derived(renderBioMarkdown(bio));
    const displayName = $derived(unknown ? $t("person.unknown") : name);

    const saveDisabled = $derived(birthDateErrString != null || deathDateErrString != null);

    function dateToIsoLocalTime(d: Date | null) {
        if (!d) return null;
        const date = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const dateStr = date < 10 ? "0" + date : date.toString();
        const monthStr = month < 10 ? "0" + month : month.toString();
        return `${year}-${monthStr}-${dateStr}`;
    }

    function parseMaskedDateStr(str: string) {
        const [day, month, year] = str.split(".");
        return new Date(Number(year), Number(month) - 1, Number(day));
    }

    function dateToMaskedDateStr(date: Date | null) {
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

    function resetFormState(p: ShowPerson | null) {
        id = p?.description.id ?? "";
        name = p?.description.name ?? "";
        unknown = p ? isUnknownPerson(p.description.name) : false;
        birthDate = p?.description.birthDate ? new Date(p.description.birthDate) : null;
        deathDate = p?.description.deathDate ? new Date(p.description.deathDate) : null;
        bio = p?.description.bio ?? "";
        pinned = p?.pin ?? false;
        personReadOnly = p?.description.readOnly ?? false;
        bioTab = p ? "preview" : "edit";
        originalPhotoUrl = p?.description.photoUrl ?? null;
        photoUrl = originalPhotoUrl;
        photoErrString = null;
        if (photoFileInputEl) photoFileInputEl.value = "";
        resetCropState();
        resetPendingPhoto();
        birthDateErrString = null;
        deathDateErrString = null;
        queueMicrotask(() => {
            if (birthInputEl) birthInputEl.value = dateToMaskedDateStr(birthDate) ?? "";
            if (deathInputEl) deathInputEl.value = dateToMaskedDateStr(deathDate) ?? "";
        });
    }

    export function showPersonDetails(p: ShowPerson) {
        mode = "view";
        createTitle = null;
        resetFormState(p);
        open = true;
    }

    export function showCreatePerson(opts: { title?: string; oncreate: (payload: CreatePersonPayload) => void }) {
        mode = "create";
        createTitle = opts.title ?? null;
        activeCreateCallback = opts.oncreate;
        resetFormState(null);
        open = true;
    }

    function close() {
        open = false;
        activeCreateCallback = null;
        resetPendingPhoto();
    }

    export function dismiss() {
        close();
    }

    function save() {
        if (saveDisabled) return;
        const description = {
            type: "CreateNewPerson" as const,
            name: unknown ? "" : name,
            birthDate: dateToIsoLocalTime(birthDate),
            deathDate: dateToIsoLocalTime(deathDate),
            bio,
        };
        if (mode === "create") {
            const cb = activeCreateCallback;
            activeCreateCallback = null;
            cb?.({
                description,
                pin: pinned,
                photoUpload: pendingPhotoBlob,
            });
        } else {
            onpersonUpdated?.({
                id,
                description,
                pin: pinned,
                photoUpload: pendingPhotoBlob,
                photoRemove: pendingPhotoRemove,
            });
        }
        close();
    }

    function remove() {
        onpersonRemoveRequested?.({ id, name: displayName });
    }

    function requestShareAccess() {
        if (!id) return;
        const personId = id;
        const personName = displayName;
        close();
        onshareAccessRequested?.({ personId, name: personName });
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
</script>

<Modal
    {open}
    title={cropping ? $t("person.photoAdjustTitle") : isCreate ? (createTitle ?? $t("addPerson")) : $t("person.title")}
    size="lg"
    scroll
    dismissOnBackdrop={!cropping}
    onclose={close}
    testid="person-details-modal"
>
    {#snippet body()}
        {#if cropping}
            <div class="crop-wrap">
                <div
                    bind:this={cropContainerEl}
                    class="crop-area"
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
                            class="crop-image"
                            style="transform: translate({cropDx}px, {cropDy}px) scale({cropBaseScale * cropScale}); visibility: {cropImageReady ? 'visible' : 'hidden'};"
                            onload={onCropImageLoaded}
                            draggable="false"
                        />
                    {/if}
                    <div class="crop-overlay"></div>
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
                <p class="hint">{$t("person.photoAdjustHint")}</p>
            </div>
        {:else}
            <div class="grid">
                <div class="col-photo">
                    <div class="photo-frame">
                        {#if photoUrl}
                            <img src={photoUrl} alt={name} class="photo-image" />
                        {:else}
                            <div class="photo-empty">{$t("person.photo")}</div>
                        {/if}
                        {#if !readOnly}
                            <button
                                type="button"
                                class="photo-upload-btn"
                                onclick={pickPhoto}
                                aria-label={photoUrl ? $t("person.photoReplace") : $t("person.photoUpload")}
                                data-testid="person-photo-upload"
                            >
                                <span class="photo-upload-label">
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

                <div class="col-fields">
                    <div class="field-row">
                        <label for="person-name" class="field-label">{$t("person.name")}</label>
                        <input
                            id="person-name"
                            class="form-control"
                            bind:value={name}
                            readonly={readOnly}
                            disabled={unknown}
                            data-testid="person-name-input"
                        />
                        {#if !readOnly}
                            <div class="form-check form-switch mt-2">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    id="person-unknown"
                                    bind:checked={unknown}
                                    onchange={() => { if (unknown) name = ""; }}
                                />
                                <label class="form-check-label" for="person-unknown">
                                    {$t("person.unknownToggle")}
                                </label>
                            </div>
                        {/if}
                    </div>

                    <div class="field-row">
                        <span class="field-label">{$t("person.lifeYears")}</span>
                        <div class="dates-row">
                            <div class="date-cell">
                                <input
                                    bind:this={birthInputEl}
                                    value={dateToMaskedDateStr(birthDate)}
                                    use:imask={dateMaskingOpts}
                                    class="form-control {birthDateErrString ? 'is-invalid' : ''}"
                                    readonly={readOnly}
                                    placeholder={$t("person.datePlaceholder")}
                                    data-testid="person-birth"
                                />
                                {#if birthDateErrString}
                                    <div class="invalid-feedback">{birthDateErrString}</div>
                                {/if}
                            </div>
                            <div class="date-cell">
                                <input
                                    bind:this={deathInputEl}
                                    value={dateToMaskedDateStr(deathDate)}
                                    use:imask={dateMaskingOpts}
                                    class="form-control {deathDateErrString ? 'is-invalid' : ''}"
                                    readonly={readOnly}
                                    placeholder={$t("person.datePlaceholder")}
                                    data-testid="person-death"
                                />
                                {#if deathDateErrString}
                                    <div class="invalid-feedback">{deathDateErrString}</div>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-bio">
                    <div class="bio-header">
                        <span class="field-label">{$t("person.bio")}</span>
                        {#if !readOnly}
                            <div class="bio-tabs">
                                <button
                                    type="button"
                                    class="bio-tab {bioTab === 'edit' ? 'active' : ''}"
                                    onclick={() => (bioTab = "edit")}
                                >{$t("person.bioEdit")}</button>
                                <button
                                    type="button"
                                    class="bio-tab {bioTab === 'preview' ? 'active' : ''}"
                                    onclick={() => (bioTab = "preview")}
                                >{$t("person.bioPreview")}</button>
                            </div>
                        {/if}
                    </div>
                    {#if !readOnly && bioTab === "edit"}
                        <textarea
                            class="form-control bio-textarea"
                            rows="6"
                            bind:value={bio}
                            data-testid="person-bio"
                        ></textarea>
                        <div class="form-text">{$t("person.bioMarkdownHint")}</div>
                    {:else if bioHtml}
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        <div class="bio-preview">{@html bioHtml}</div>
                    {:else}
                        <div class="bio-preview text-muted fst-italic">{$t("person.bioEmpty")}</div>
                    {/if}
                </div>

                {#if editingAllowed}
                    <div class="col-pin">
                        <div class="form-check form-switch">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                id="person-pin"
                                bind:checked={pinned}
                            />
                            <label class="form-check-label" for="person-pin">{$t("person.pin")}</label>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    {/snippet}

    {#snippet footer()}
        {#if cropping}
            <button type="button" class="btn btn-secondary" onclick={cancelCrop}>{$t("common.cancel")}</button>
            <button
                type="button"
                class="btn btn-primary"
                disabled={!cropImageReady}
                onclick={confirmCrop}
                data-testid="person-crop-save"
            >{$t("common.save")}</button>
        {:else if isCreate}
            <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.cancel")}</button>
            <button
                type="button"
                class="btn btn-primary"
                disabled={saveDisabled}
                onclick={save}
                data-testid="person-create"
            >{$t("common.create")}</button>
        {:else if editingAllowed}
            <button
                type="button"
                class="btn btn-danger me-auto"
                onclick={remove}
                data-testid="person-delete"
            >{$t("common.delete")}</button>
            {#if !personReadOnly}
                <button
                    type="button"
                    class="btn btn-outline-primary"
                    onclick={requestShareAccess}
                    data-testid="share-access-btn"
                >{$t("shareAccess")}</button>
            {/if}
            <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.cancel")}</button>
            <button
                type="button"
                class="btn btn-primary"
                disabled={saveDisabled}
                onclick={save}
                data-testid="person-save"
            >{$t("common.save")}</button>
        {:else}
            {#if !personReadOnly}
                <button
                    type="button"
                    class="btn btn-outline-primary me-auto"
                    onclick={requestShareAccess}
                    data-testid="share-access-btn"
                >{$t("shareAccess")}</button>
            {/if}
            <button type="button" class="btn btn-secondary" onclick={close}>{$t("common.close")}</button>
        {/if}
    {/snippet}
</Modal>

<style>
    .grid {
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 16px;
    }

    .col-photo { grid-column: 1; grid-row: 1; }
    .col-fields { grid-column: 2; grid-row: 1; }
    .col-bio { grid-column: 1 / -1; }
    .col-pin { grid-column: 1 / -1; }

    @media (max-width: 560px) {
        .grid {
            grid-template-columns: 1fr;
        }
        .col-photo, .col-fields { grid-column: 1; grid-row: auto; }
    }

    .field-row + .field-row {
        margin-top: 12px;
    }

    .field-label {
        display: block;
        margin: 4px 0 6px;
        font-size: var(---fs-label);
        color: var(---text-secondary);
        font-weight: var(---fw-label);
    }

    .dates-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .date-cell {
        position: relative;
    }

    .photo-frame {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #e9ecef;
        background-color: #f8f9fa;
    }

    .photo-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .photo-empty {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(---text-muted);
        font-size: var(---fs-label);
    }

    .photo-upload-btn {
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
        transition: background-color 0.15s ease;
    }

    .photo-upload-btn:hover,
    .photo-upload-btn:focus-visible {
        background-color: rgba(0, 0, 0, 0.35);
    }

    .photo-upload-label {
        width: 100%;
        padding: 0.5rem;
        background-color: rgba(0, 0, 0, 0.55);
        color: #fff;
        font-size: var(---fs-label);
        text-align: center;
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .photo-frame:has(.photo-empty) .photo-upload-label,
    .photo-upload-btn:hover .photo-upload-label,
    .photo-upload-btn:focus-visible .photo-upload-label {
        opacity: 1;
    }

    .bio-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
    }

    .bio-tabs {
        display: inline-flex;
        background: #f1f3f5;
        border-radius: 8px;
        padding: 2px;
    }

    .bio-tab {
        padding: 4px 10px;
        background: none;
        border: none;
        font-size: var(---fs-hint);
        color: var(---text-muted);
        border-radius: 6px;
        cursor: pointer;
        font-weight: var(---fw-label);
    }

    .bio-tab.active {
        background: var(---bg-surface);
        color: var(---text-primary);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .bio-textarea {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: var(---fs-body);
    }

    .bio-preview {
        min-height: 6rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid #e9ecef;
        border-radius: 10px;
        background-color: #fff;
        line-height: 1.5;
        font-size: 0.95rem;
        overflow-wrap: anywhere;
    }

    .bio-preview :global(p) { margin: 0 0 0.75rem; }
    .bio-preview :global(p:last-child) { margin-bottom: 0; }
    .bio-preview :global(h1),
    .bio-preview :global(h2),
    .bio-preview :global(h3),
    .bio-preview :global(h4),
    .bio-preview :global(h5),
    .bio-preview :global(h6) {
        margin: 1rem 0 0.5rem;
        font-weight: 600;
    }
    .bio-preview :global(h1) { font-size: 1.4rem; }
    .bio-preview :global(h2) { font-size: 1.25rem; }
    .bio-preview :global(h3) { font-size: 1.1rem; }
    .bio-preview :global(ul),
    .bio-preview :global(ol) {
        padding-left: 1.25rem;
        margin-bottom: 0.75rem;
    }
    .bio-preview :global(a) { color: #0d6efd; word-break: break-word; }
    .bio-preview :global(blockquote) {
        margin: 0 0 0.75rem;
        padding: 0.25rem 0.75rem;
        border-left: 3px solid #e9ecef;
        color: var(---text-muted);
    }
    .bio-preview :global(code) {
        padding: 0.1em 0.3em;
        font-size: 0.875em;
        background-color: rgba(0, 0, 0, 0.06);
        border-radius: 0.25rem;
    }

    .crop-wrap {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .crop-area {
        position: relative;
        width: 100%;
        max-width: 400px;
        aspect-ratio: 1 / 1;
        margin: 0 auto;
        border-radius: 12px;
        overflow: hidden;
        background-color: #000;
        cursor: grab;
        touch-action: none;
        user-select: none;
    }

    .crop-area:active { cursor: grabbing; }

    .crop-image {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        pointer-events: none;
        max-width: none;
    }

    .crop-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
    }

    .hint {
        margin: 0;
        color: var(---text-muted);
        font-size: var(---fs-hint);
        text-align: center;
    }

</style>
