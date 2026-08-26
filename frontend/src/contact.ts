// The public contact address. It is a forwarding alias on the project's own domain (see
// contactMailRecords in template.yaml), so no personal address is published on the site.
// The legal pages under public/ are static HTML and spell the same address out literally;
// contact.test.ts fails if the two drift apart.
export const CONTACT_EMAIL = "admin@stemma.link";

export function contactMailto(subject: string): string {
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
