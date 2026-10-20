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
    import { locale, t } from "../i18n";
    import { formatLifespan, isBefore, parseDateInput, toDateInput } from "../partialDate";
    import { renderBioMarkdown } from "../bioMarkdown";
    import { isUnknownPerson, personDisplayName } from "../personDisplayName";
    import type { AltName, AltNameKind, CreateNewPerson } from "../model";
    import SidePanel from "./SidePanel.svelte";
    import Attachments from "./Attachments.svelte";
    import type { Attachment } from "../model";

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
        attachmentsOf?: (personId: string) => Attachment[];
        onattachLink?: (payload: { personId: string; title: string; url: string; note: string }) => Promise<unknown> | void;
        onattachFile?: (payload: { personId: string; file: File; title: string }) => Promise<unknown> | void;
        onremoveAttachment?: (id: string) => void;
    };

    let {
        editMode = false,
        onpersonUpdated,
        onpersonRemoveRequested,
        onshareAccessRequested,
        attachmentsOf,
        onattachLink,
        onattachFile,
        onremoveAttachment,
    }: Props = $props();

    let open = $state(false);
    let mode = $state<"view" | "create">("view");
    let createTitle = $state<string | null>(null);
    let activeCreateCallback: ((payload: CreatePersonPayload) => void) | null = null;
    const isCreate = $derived(mode === "create");
    /** An empty bio is a link until asked for, so the card stays short. */
    let bioOpen = $state(false);
    let birthInputEl = $state<HTMLInputElement | null>(null);
    let deathInputEl = $state<HTMLInputElement | null>(null);
    let photoFileInputEl = $state<HTMLInputElement | null>(null);

    let pinned = $state(false);
    let unknown = $state(false);
    let name = $state("");
    // Stored form ("1899", "1899-03", "~1899-03-16") and what is typed in the field.
    let birthDate = $state<string | null>(null);
    let deathDate = $state<string | null>(null);
    let birthText = $state("");
    let deathText = $state("");
    let bio = $state("");
    let altNames = $state<AltName[]>([]);
    const ALT_NAME_KINDS: AltNameKind[] = ["maiden", "married", "variant", "other"];
    let id = $state("");
    let personReadOnly = $state(false);
    const editingAllowed = $derived(isCreate || (editMode && !personReadOnly));
    const pinningAllowed = $derived(!isCreate && !personReadOnly);
    const readOnly = $derived(!editingAllowed);
    let photoUrl = $state<string | null>(null);
    let photoErrString = $state<string | null>(null);
    let originalPhotoUrl: string | null = null;
    let pendingPhotoBlob = $state<Blob | null>(null);
    let pendingPhotoPreviewUrl = $state<string | null>(null);
    let pendingPhotoRemove = $state(false);
    /** The photo shown full size over everything, in view mode. */
    let photoZoomed = $state(false);

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

    const bioHtml = $derived(renderBioMarkdown(bio));
    const personAttachments = $derived(id ? (attachmentsOf?.(id) ?? []) : []);
    const viewLifespan = $derived(formatLifespan(birthDate, deathDate, $locale));

    const displayName = $derived(unknown ? personDisplayName(null) : personDisplayName(name));

    const saveDisabled = $derived(birthDateErrString != null || deathDateErrString != null);

    function onDateInput(which: "birth" | "death", text: string) {
        const parsed = parseDateInput(text);
        const err = parsed.ok ? null : $t("person.incompleteDate");
        if (which === "birth") {
            birthText = text;
            birthDateErrString = err;
            if (parsed.ok) birthDate = parsed.value;
        } else {
            deathText = text;
            deathDateErrString = err;
            if (parsed.ok) deathDate = parsed.value;
        }
        if (parsed.ok) validateLifetimeRange();
    }

    function validateLifetimeRange() {
        if (birthDateErrString && birthDateErrString !== $t("person.invalidDateRange")) return;
        if (deathDateErrString && deathDateErrString !== $t("person.invalidDateRange")) return;
        const invalid = !!birthDate && !!deathDate && isBefore(deathDate, birthDate);
        birthDateErrString = invalid ? $t("person.invalidDateRange") : null;
        deathDateErrString = invalid ? $t("person.invalidDateRange") : null;
    }

    function cleanAltNames(): AltName[] {
        return altNames.map((a) => ({ name: a.name.trim(), kind: a.kind })).filter((a) => a.name !== "");
    }

    function addAltName() {
        altNames = [...altNames, { name: "", kind: "maiden" }];
    }

    function removeAltName(i: number) {
        altNames = altNames.filter((_, j) => j !== i);
    }

    function resetFormState(p: ShowPerson | null) {
        id = p?.description.id ?? "";
        name = p?.description.name ?? "";
        unknown = p ? isUnknownPerson(p.description.name) : false;
        birthDate = p?.description.birthDate ?? null;
        deathDate = p?.description.deathDate ?? null;
        birthText = toDateInput(birthDate);
        deathText = toDateInput(deathDate);
        bio = p?.description.bio ?? "";
        altNames = (p?.description.altNames ?? []).map((a) => ({ ...a }));
        pinned = p?.pin ?? false;
        personReadOnly = p?.description.readOnly ?? false;
        bioOpen = !!p?.description.bio?.trim();
        originalPhotoUrl = p?.description.photoUrl ?? null;
        photoUrl = originalPhotoUrl;
        photoErrString = null;
        photoZoomed = false;
        if (photoFileInputEl) photoFileInputEl.value = "";
        resetCropState();
        resetPendingPhoto();
        birthDateErrString = null;
        deathDateErrString = null;
    }

    export function showPersonDetails(p: ShowPerson) {
        mode = "view";
        createTitle = null;
        resetFormState(p);
        open = true;
    }

    export function showCreatePerson(opts: {
        title?: string;
        oncreate: (payload: CreatePersonPayload) => void;
    }) {
        mode = "create";
        createTitle = opts.title ?? null;
        activeCreateCallback = opts.oncreate;
        resetFormState(null);
        open = true;
    }

    function close() {
        open = false;
        photoZoomed = false;
        activeCreateCallback = null;
        resetPendingPhoto();
    }

    export function dismiss() {
        close();
    }

    /** Closes a card that is only being looked at; a form being filled in stays open. */
    export function dismissIfViewing() {
        if (open && readOnly) close();
    }

    let pinDebounce: ReturnType<typeof setTimeout> | null = null;

    function savePinOnly() {
        if (pinDebounce !== null) clearTimeout(pinDebounce);
        pinDebounce = setTimeout(() => {
            pinDebounce = null;
            onpersonUpdated?.({
                id,
                description: {
                    type: "CreateNewPerson" as const,
                    name: unknown ? "" : name,
                    birthDate,
                    deathDate,
                    bio,
                    altNames: cleanAltNames(),
                },
                pin: pinned,
                photoUpload: null,
                photoRemove: false,
            });
        }, 300);
    }

    function save() {
        if (saveDisabled) return;
        const description = {
            type: "CreateNewPerson" as const,
            name: unknown ? "" : name,
            birthDate,
            deathDate,
            bio,
            altNames: cleanAltNames(),
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

    function handlePhotoZoomKeydown(e: KeyboardEvent) {
        if (!photoZoomed || e.key !== "Escape") return;
        // the card under the photo must not take this Escape too
        e.stopImmediatePropagation();
        photoZoomed = false;
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

<SidePanel
    {open}
    title={cropping ? $t("person.photoAdjustTitle") : isCreate ? (createTitle ?? $t("addPerson")) : $t("person.title")}
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
            <div class="profile">
                <div class="avatar" class:editable={!readOnly}>
                    {#if photoUrl && readOnly}
                        <button
                            type="button"
                            class="photo-zoom-btn"
                            onclick={() => (photoZoomed = true)}
                            aria-label={$t("person.photoOpen")}
                            data-testid="person-photo-open"
                        ><img src={photoUrl} alt={name} class="photo-image" /></button>
                    {:else if photoUrl}
                        <img src={photoUrl} alt={name} class="photo-image" />
                    {:else}
                        <div class="photo-empty"><i class="bi bi-person"></i></div>
                    {/if}
                    {#if !readOnly}
                        <button
                            type="button"
                            class="photo-upload-btn"
                            onclick={pickPhoto}
                            aria-label={photoUrl ? $t("person.photoReplace") : $t("person.photoUpload")}
                            data-testid="person-photo-upload"
                        ><i class="bi bi-camera"></i></button>
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
                    <button type="button" class="btn btn-link btn-sm text-danger p-0" onclick={removePhoto}>
                        {$t("person.photoRemove")}
                    </button>
                {/if}
                {#if photoErrString}
                    <div class="text-danger small">{photoErrString}</div>
                {/if}

                {#if readOnly}
                    <div class="view-name" data-testid="person-view-name">{displayName}</div>
                    {#if altNames.length > 0}
                        <div class="view-alt-names" data-testid="person-alt-names">
                            {#each altNames as alt, i}
                                {#if i > 0}<span class="sep">·</span>{/if}
                                <span><span class="alt-kind">{$t(`person.altKind.${alt.kind}`)}</span> {alt.name}</span>
                            {/each}
                        </div>
                    {/if}
                    {#if viewLifespan}
                        <div class="view-dates">{viewLifespan}</div>
                    {/if}
                {:else}
                    <input
                        id="person-name"
                        class="form-control name-input"
                        bind:value={name}
                        disabled={unknown}
                        placeholder={$t("person.namePlaceholder")}
                        aria-label={$t("person.name")}
                        autocomplete="off"
                        data-testid="person-name-input"
                    />
                    <label class="unknown-check">
                        <input type="checkbox" id="person-unknown" bind:checked={unknown} onchange={() => { if (unknown) name = ""; }} />
                        {$t("person.unknownToggle")}
                    </label>

                    <div class="alt-names-edit" data-testid="person-alt-names">
                        {#each altNames as alt, i}
                            <div class="alt-name-row">
                                <select class="form-select alt-kind-select" bind:value={alt.kind} data-testid="person-alt-kind">
                                    {#each ALT_NAME_KINDS as kind}
                                        <option value={kind}>{$t(`person.altKind.${kind}`)}</option>
                                    {/each}
                                </select>
                                <input
                                    class="form-control"
                                    bind:value={alt.name}
                                    placeholder={$t("namePlaceholder")}
                                    data-testid="person-alt-name-input"
                                />
                                <button
                                    type="button"
                                    class="btn btn-outline-secondary"
                                    aria-label={$t("person.removeAltName")}
                                    onclick={() => removeAltName(i)}
                                ><i class="bi bi-x"></i></button>
                            </div>
                        {/each}
                        <button
                            type="button"
                            class="btn btn-link btn-sm p-0"
                            onclick={addAltName}
                            data-testid="person-add-alt-name"
                        >{$t("person.addAltName")}</button>
                    </div>

                    <div class="dates-row">
                        <div class="date-cell">
                            <label class="mini-label" for="person-birth-input">{$t("person.born")}</label>
                            <input
                                id="person-birth-input"
                                bind:this={birthInputEl}
                                value={birthText}
                                oninput={(e) => onDateInput("birth", e.currentTarget.value)}
                                class="form-control {birthDateErrString ? 'is-invalid' : ''}"
                                placeholder={$t("person.dateExample")}
                                data-testid="person-birth"
                            />
                        </div>
                        <span class="dash">–</span>
                        <div class="date-cell">
                            <label class="mini-label" for="person-death-input">{$t("person.died")}</label>
                            <input
                                id="person-death-input"
                                bind:this={deathInputEl}
                                value={deathText}
                                oninput={(e) => onDateInput("death", e.currentTarget.value)}
                                class="form-control {deathDateErrString ? 'is-invalid' : ''}"
                                placeholder={$t("person.dateExample")}
                                data-testid="person-death"
                            />
                        </div>
                    </div>
                    <!-- below both fields, so an error never pushes one field out of line -->
                    {#if birthDateErrString ?? deathDateErrString}
                        <div class="date-hint date-error" data-testid="person-date-error">{birthDateErrString ?? deathDateErrString}</div>
                    {:else}
                        <div class="date-hint">{$t("person.datePlaceholder")}</div>
                    {/if}
                {/if}
            </div>

            {#if readOnly}
                {#if bioHtml}
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    <div class="bio-preview" data-testid="person-bio-view">{@html bioHtml}</div>
                {/if}
                {#if id && personAttachments.length > 0}
                    <div class="section">
                        <Attachments attachments={personAttachments} editable={false} />
                    </div>
                {/if}
            {:else}
                <div class="section bio-section" class:grow={bioOpen}>
                    {#if bioOpen}
                        <label class="field-label" for="person-bio-input">{$t("person.bio")}</label>
                        <textarea
                            id="person-bio-input"
                            class="form-control bio-textarea"
                            rows="5"
                            bind:value={bio}
                            data-testid="person-bio"
                        ></textarea>
                        <div class="form-text">{$t("person.bioMarkdownHint")}</div>
                    {:else}
                        <button type="button" class="btn btn-link btn-sm p-0" onclick={() => (bioOpen = true)} data-testid="person-add-bio">
                            {$t("person.addBio")}
                        </button>
                    {/if}
                </div>
                {#if id}
                    <div class="section">
                        <Attachments
                            attachments={personAttachments}
                            editable={editingAllowed}
                            onaddLink={(p) => onattachLink?.({ personId: id, ...p })}
                            onaddFile={(p) => onattachFile?.({ personId: id, ...p })}
                            onremove={(aid) => onremoveAttachment?.(aid)}
                        />
                    </div>
                {/if}
            {/if}

        {/if}
    {/snippet}

    {#snippet footer()}
        {#if pinningAllowed && !cropping}
            <!-- with the buttons, so a long bio never pushes it out of sight -->
            <div class="form-check form-switch pin-row">
                <input
                    class="form-check-input"
                    type="checkbox"
                    id="person-pin"
                    bind:checked={pinned}
                    onchange={!editingAllowed ? savePinOnly : undefined}
                />
                <label class="form-check-label" for="person-pin">{$t("person.pin")}</label>
            </div>
        {/if}
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
            <button
                type="button"
                class="btn btn-primary"
                disabled={saveDisabled}
                onclick={save}
                data-testid="person-create"
            >{$t("person.add")}</button>
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
        {/if}
    {/snippet}
</SidePanel>

<svelte:window onkeydown={handlePhotoZoomKeydown} />

{#if photoZoomed && photoUrl}
    <!-- Escape is handled on the window; a click anywhere closes it -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="photo-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={displayName}
        tabindex="-1"
        data-testid="person-photo-lightbox"
        onclick={() => (photoZoomed = false)}
    >
        <img src={photoUrl} alt={name} class="photo-lightbox-image" />
        <button type="button" class="photo-lightbox-close" aria-label={$t("common.close")}>
            <i class="bi bi-x-lg"></i>
        </button>
    </div>
{/if}

<style>
    .profile {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
    }

    .avatar {
        position: relative;
        width: 112px;
        height: 112px;
        border-radius: 50%;
        overflow: hidden;
        background-color: #f1f3f5;
        border: 1px solid #e9ecef;
        margin-bottom: 4px;
    }

    .photo-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .photo-zoom-btn {
        display: block;
        width: 100%;
        height: 100%;
        padding: 0;
        border: none;
        background: none;
        cursor: zoom-in;
    }

    .photo-lightbox {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background-color: rgba(0, 0, 0, 0.85);
        cursor: zoom-out;
    }

    .photo-lightbox-image {
        width: min(100%, 90vh, 640px);
        height: auto;
        aspect-ratio: 1;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .photo-lightbox-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.15);
        color: #fff;
        font-size: 1.1rem;
        cursor: pointer;
    }

    .photo-empty {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #adb5bd;
        font-size: 3rem;
    }

    .photo-upload-btn {
        position: absolute;
        inset: 0;
        border: none;
        background: transparent;
        color: #fff;
        font-size: 1.4rem;
        opacity: 0;
        cursor: pointer;
        transition: opacity 0.15s ease, background-color 0.15s ease;
    }

    .avatar.editable:hover .photo-upload-btn,
    .photo-upload-btn:focus-visible {
        opacity: 1;
        background-color: rgba(0, 0, 0, 0.4);
    }

    .avatar.editable:not(:has(.photo-image)) .photo-upload-btn {
        opacity: 1;
        color: #6c757d;
        align-items: flex-end;
        display: flex;
        justify-content: flex-end;
        padding: 10px 14px;
        font-size: 1rem;
    }

    .view-name {
        font-size: 1.3rem;
        font-weight: 600;
        line-height: 1.3;
        overflow-wrap: anywhere;
    }

    .view-alt-names {
        color: var(---text-secondary);
        font-size: 0.95rem;
    }

    .view-alt-names .sep {
        margin: 0 6px;
        color: var(---text-muted);
    }

    .view-dates {
        color: var(---text-secondary);
    }

    .name-input {
        text-align: center;
        font-size: 1.1rem;
        font-weight: 500;
    }

    .unknown-check {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: var(---fs-hint);
        color: var(---text-muted);
        cursor: pointer;
    }

    .alt-names-edit {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .dates-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        width: 100%;
        max-width: 340px;
        margin-top: 4px;
    }

    .date-cell {
        flex: 1;
        min-width: 0;
        position: relative;
        text-align: left;
    }

    .dash {
        padding-bottom: 7px;
        color: var(---text-muted);
    }

    .mini-label {
        display: block;
        font-size: var(---fs-hint);
        color: var(---text-muted);
        margin-bottom: 2px;
    }

    .date-hint {
        font-size: var(---fs-hint);
        color: var(---text-muted);
    }

    .date-hint.date-error {
        max-width: 340px;
        color: var(--bs-form-invalid-color, #dc3545);
    }

    .section {
        margin-top: 16px;
    }

    .profile + .bio-preview {
        margin-top: 16px;
    }

    .pin-row {
        width: 100%;
        margin: 0 0 4px;
    }

    .field-label {
        display: block;
        margin: 4px 0 6px;
        font-size: var(---fs-label);
        color: var(---text-secondary);
        font-weight: var(---fw-label);
    }

    .alt-name-row {
        width: 100%;
        display: flex;
        gap: 6px;
        margin-bottom: 6px;
    }

    .alt-kind-select {
        flex: 0 0 auto;
        width: auto;
    }

    .alt-kind {
        color: var(---text-muted);
    }

    .bio-textarea {
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: var(---fs-body);
        resize: none;
        min-height: 8rem;
    }

    /* an open bio takes all the room the panel has left; longer text scrolls inside */
    .bio-section.grow {
        flex: 1 0 auto;
        display: flex;
        flex-direction: column;
        min-height: 12rem;
    }

    .bio-section.grow .bio-textarea {
        flex: 1;
        overflow-y: auto;
    }

    .bio-preview {
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
