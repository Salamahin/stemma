/**
 * @jest-environment jsdom
 */
import { renderBioMarkdown } from "./bioMarkdown";

describe("renderBioMarkdown", () => {
    test("returns empty string for null/undefined/empty", () => {
        expect(renderBioMarkdown(null)).toBe("");
        expect(renderBioMarkdown(undefined)).toBe("");
        expect(renderBioMarkdown("")).toBe("");
    });

    test("wraps plain text in paragraph", () => {
        const html = renderBioMarkdown("Just a sentence.");
        expect(html).toContain("<p>");
        expect(html).toContain("Just a sentence.");
    });

    test("renders emphasis and strong", () => {
        const html = renderBioMarkdown("*emph* and **strong**");
        expect(html).toContain("<em>emph</em>");
        expect(html).toContain("<strong>strong</strong>");
    });

    test("renders unordered list", () => {
        const html = renderBioMarkdown("- one\n- two\n- three");
        expect(html).toContain("<ul>");
        expect(html).toContain("<li>one</li>");
        expect(html).toContain("<li>two</li>");
    });

    test("renders ordered list", () => {
        const html = renderBioMarkdown("1. first\n2. second");
        expect(html).toContain("<ol>");
        expect(html).toContain("<li>first</li>");
    });

    test("renders headings", () => {
        const html = renderBioMarkdown("# Title\n\n## Sub");
        expect(html).toContain("<h1>Title</h1>");
        expect(html).toContain("<h2>Sub</h2>");
    });

    test("renders link with href", () => {
        const html = renderBioMarkdown("[ref](https://example.org/a)");
        expect(html).toContain('href="https://example.org/a"');
        expect(html).toContain(">ref</a>");
    });

    test("renders multiple paragraphs separated by blank line", () => {
        const html = renderBioMarkdown("First line.\n\nSecond line.");
        const paragraphs = html.match(/<p>/g) ?? [];
        expect(paragraphs.length).toBe(2);
    });

    test("plain text without markdown still renders", () => {
        const html = renderBioMarkdown("Born in 1900 in Moscow.");
        expect(html).toContain("Born in 1900 in Moscow.");
    });

    test("strips script tags", () => {
        const html = renderBioMarkdown("hi <script>alert(1)</script> bye");
        expect(html).not.toContain("<script");
        expect(html).not.toContain("alert(1)");
    });

    test("strips onerror handlers from inline html", () => {
        const html = renderBioMarkdown('<img src=x onerror="alert(1)">');
        expect(html).not.toContain("onerror");
        expect(html).not.toContain("alert");
    });

    test("strips javascript: hrefs", () => {
        const html = renderBioMarkdown("[click](javascript:alert(1))");
        expect(html).not.toContain("javascript:");
    });

    test("strips inline iframe", () => {
        const html = renderBioMarkdown('<iframe src="https://evil.example"></iframe>');
        expect(html).not.toContain("<iframe");
    });

    test("strips style attribute", () => {
        const html = renderBioMarkdown('<p style="background:url(javascript:alert(1))">x</p>');
        expect(html).not.toContain("style=");
        expect(html).not.toContain("javascript:");
    });
});
