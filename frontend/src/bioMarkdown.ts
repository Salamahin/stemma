import { Marked } from "marked";
import DOMPurify, { type Config } from "dompurify";

const marked = new Marked({ gfm: true, breaks: true });

const SANITIZE_CONFIG: Config = {
    ALLOWED_TAGS: [
        "p", "br", "strong", "em", "del", "code", "pre",
        "a", "blockquote", "hr",
        "ul", "ol", "li",
        "h1", "h2", "h3", "h4", "h5", "h6",
        "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "title"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

export function renderBioMarkdown(input: string | null | undefined): string {
    if (!input) return "";
    const html = marked.parse(input, { async: false }) as string;
    return DOMPurify.sanitize(html, SANITIZE_CONFIG) as unknown as string;
}
