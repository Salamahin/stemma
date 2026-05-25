const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const EXPORT_FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const EXPORT_TEXT_FILL = "#212529";

export type BBox = { x: number; y: number; width: number; height: number };

export function buildExportableSvg(source: SVGSVGElement, bbox: BBox, padding = 20): string {
    const clone = source.cloneNode(true) as SVGSVGElement;

    clone.removeAttribute("class");
    clone.removeAttribute("style");

    const main = clone.querySelector("g.main");
    if (main) main.removeAttribute("transform");

    const width = Math.max(1, Math.ceil(bbox.width + padding * 2));
    const height = Math.max(1, Math.ceil(bbox.height + padding * 2));
    const minX = Math.floor(bbox.x - padding);
    const minY = Math.floor(bbox.y - padding);

    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("xmlns:xlink", XLINK_NS);
    clone.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("font-family", EXPORT_FONT_FAMILY);
    clone.setAttribute("fill", EXPORT_TEXT_FILL);

    return new XMLSerializer().serializeToString(clone);
}

export function downloadSvg(content: string, filename: string): void {
    const blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function exportChartSvg(source: SVGSVGElement, filename: string): void {
    const main = source.querySelector("g.main") as SVGGraphicsElement | null;
    const bbox: BBox = main && typeof main.getBBox === "function"
        ? main.getBBox()
        : { x: 0, y: 0, width: source.clientWidth || 800, height: source.clientHeight || 600 };
    downloadSvg(buildExportableSvg(source, bbox), filename);
}
