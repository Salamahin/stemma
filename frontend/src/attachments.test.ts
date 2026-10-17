import { get } from "svelte/store";
import { AppController } from "./appController";
import { attachmentsOf, isImageAttachment } from "./attachments";
import type { Attachment, Stemma } from "./model";

const link: Attachment = { type: "AttachmentDescription", id: "a1", ownerKind: "person", ownerId: "p1", kind: "link", title: "ОБД", url: "https://x" };
const scan: Attachment = { type: "AttachmentDescription", id: "a2", ownerKind: "family", ownerId: "f1", kind: "file", title: "Брак", url: "https://s3/x", contentType: "image/png" };
const stemma: Stemma = { type: "Stemma", people: [], families: [], attachments: [link, scan] };

async function drainAll() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("attachmentsOf", () => {
    test("picks the attachments of one person or family", () => {
        expect(attachmentsOf(stemma, "person", "p1")).toEqual([link]);
        expect(attachmentsOf(stemma, "family", "f1")).toEqual([scan]);
        expect(attachmentsOf(stemma, "person", "f1")).toEqual([]);
        expect(attachmentsOf(null, "person", "p1")).toEqual([]);
        expect(attachmentsOf({ type: "Stemma", people: [], families: [] }, "person", "p1")).toEqual([]);
    });

    test("recognises image files", () => {
        expect(isImageAttachment(scan)).toBe(true);
        expect(isImageAttachment(link)).toBe(false);
    });
});

describe("AppController attachments", () => {
    function controller(model: any) {
        const c = new AppController("http://example", model);
        c.currentStemmaId.set("s1");
        return c;
    }

    test("a file is uploaded to the issued url and then attached", async () => {
        const model = {
            requestAttachmentUploadUrl: jest.fn().mockResolvedValue({ type: "AttachmentUploadUrl", uploadUrl: "https://s3", uploadFields: { k: "v" }, fileKey: "stemmas/s1/attachments/x", expiresInSeconds: 300 }),
            uploadPhotoToPresignedUrl: jest.fn().mockResolvedValue(undefined),
            addFileAttachment: jest.fn().mockResolvedValue(stemma),
        };
        const c = controller(model);
        const file = new File(["%PDF"], "metrika.pdf", { type: "application/pdf" });
        await c.attachFile("person", "p1", file, "");
        await drainAll();
        expect(model.requestAttachmentUploadUrl).toHaveBeenCalledWith("s1", "person", "p1", "application/pdf");
        expect(model.uploadPhotoToPresignedUrl).toHaveBeenCalledWith("https://s3", { k: "v" }, file);
        expect(model.addFileAttachment).toHaveBeenCalledWith("s1", "person", "p1", "metrika.pdf", "stemmas/s1/attachments/x", "application/pdf");
        expect(get(c.stemma)).toEqual(stemma);
    });

    test("links and removals go through the model and update the stemma", async () => {
        const model = {
            addLinkAttachment: jest.fn().mockResolvedValue(stemma),
            removeAttachment: jest.fn().mockResolvedValue({ ...stemma, attachments: [] }),
        };
        const c = controller(model);
        await c.attachLink("family", "f1", "Запись о браке", "https://x", "");
        expect(model.addLinkAttachment).toHaveBeenCalledWith("s1", "family", "f1", "Запись о браке", "https://x", null);
        await c.removeAttachment("a1");
        expect(model.removeAttachment).toHaveBeenCalledWith("s1", "a1");
        expect(get(c.stemma)?.attachments).toEqual([]);
    });
});
