import { readFileSync } from "node:fs";

import { CONTACT_EMAIL, contactMailto } from "./contact";

const LEGAL_PAGES = ["public/privacy.html", "public/terms.html"];
const ANY_EMAIL = /[\w.+-]+@[\w.-]+\.\w+/g;

describe("contactMailto", () => {
    it("targets the public contact address", () => {
        expect(contactMailto("stemma")).toBe("mailto:contactus@stemma.link?subject=stemma");
    });

    it("escapes subjects that contain spaces", () => {
        expect(contactMailto("stemma privacy")).toBe("mailto:contactus@stemma.link?subject=stemma%20privacy");
    });
});

// The legal pages are plain static HTML served straight from S3, so they spell the address
// out rather than importing it. This is what keeps them from drifting — and what catches a
// personal address being pasted back in.
describe.each(LEGAL_PAGES)("%s", (page) => {
    it("names no address other than the public contact one", () => {
        const addresses = new Set(readFileSync(page, "utf8").match(ANY_EMAIL) ?? []);

        expect([...addresses]).toEqual([CONTACT_EMAIL]);
    });
});
