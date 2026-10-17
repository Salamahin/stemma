import type { Attachment, AttachmentOwnerKind, Stemma } from "./model";

/** File types the backend accepts for attachments (must match ALLOWED_ATTACHMENT_CONTENT_TYPES). */
export const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export function attachmentsOf(stemma: Stemma | null | undefined, ownerKind: AttachmentOwnerKind, ownerId: string): Attachment[] {
    return (stemma?.attachments ?? []).filter((a) => a.ownerKind === ownerKind && a.ownerId === ownerId);
}

export function isImageAttachment(a: Attachment): boolean {
    return a.kind === "file" && (a.contentType ?? "").startsWith("image/");
}
