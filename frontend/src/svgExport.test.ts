import { buildExportableSvg } from "./svgExport";

const SVG_NS = "http://www.w3.org/2000/svg";

function makeChartSvg(): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("id", "chart");
    svg.setAttribute("class", "w-100 p-3 fullHeight");

    const main = document.createElementNS(SVG_NS, "g");
    main.setAttribute("class", "main");
    main.setAttribute("transform", "translate(120, 50) scale(1.5)");

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("fill", "#326f93");
    main.appendChild(circle);

    svg.appendChild(main);
    return svg;
}

describe("buildExportableSvg", () => {
    test("strips host classes and live transform", () => {
        const svg = makeChartSvg();
        const out = buildExportableSvg(svg, { x: 0, y: 0, width: 100, height: 80 });

        expect(out).not.toContain('class="w-100 p-3 fullHeight"');
        expect(out).not.toContain("translate(120, 50)");
    });

    test("adds svg namespace and viewBox derived from bbox + padding", () => {
        const svg = makeChartSvg();
        const out = buildExportableSvg(svg, { x: 10, y: 20, width: 100, height: 80 }, 20);

        expect(out).toContain(`xmlns="${SVG_NS}"`);
        expect(out).toContain(`viewBox="-10 0 140 120"`);
        expect(out).toContain(`width="140"`);
        expect(out).toContain(`height="120"`);
    });

    test("inlines export font + text fill", () => {
        const svg = makeChartSvg();
        const out = buildExportableSvg(svg, { x: 0, y: 0, width: 10, height: 10 });

        expect(out).toMatch(/font-family="[^"]+"/);
        expect(out).toContain('fill="#212529"');
    });

    test("preserves rendered child styling", () => {
        const svg = makeChartSvg();
        const out = buildExportableSvg(svg, { x: 0, y: 0, width: 10, height: 10 });

        expect(out).toContain('fill="#326f93"');
    });

    test("does not mutate source svg", () => {
        const svg = makeChartSvg();
        const originalTransform = svg.querySelector("g.main")?.getAttribute("transform");
        buildExportableSvg(svg, { x: 0, y: 0, width: 10, height: 10 });

        expect(svg.querySelector("g.main")?.getAttribute("transform")).toBe(originalTransform);
        expect(svg.getAttribute("class")).toBe("w-100 p-3 fullHeight");
    });
});
