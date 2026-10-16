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

export type ExportModel = {
    nodes: Array<{
        id: string;
        type: "person" | "family";
        name: string | null;
        x: number;
        y: number;
        r: number;
        fill: string;
        highlighted: boolean;
        pinned: boolean;
        labelDx: number;
        labelDy: number;
        labelHidden: boolean;
        labelWidth: number;
        bold: boolean;
    }>;
    links: Array<{ x1: number; y1: number; x2: number; y2: number; arrow: "person" | "family"; stroke: string; width: string }>;
    clans: Array<{ color: string; path: string; hull: Array<[number, number]>; label: string; fontSize: number; cx: number; cy: number; angle: number }>;
    pinPath: string;
    labelFontSize: string;
};

const SHADED_TEXT = "#d3d3d3";
const ARROW_PATH = "M 0 0 L 10 3 L 0 6 Z";

/**
 * Rebuilds the chart as an SVG element (same structure the SVG renderer used
 * to produce) so it can be exported as a vector file.
 */
export function buildChartSvgElement(model: ExportModel): { svg: SVGSVGElement; bbox: BBox } {
    const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
        const e = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
        return e;
    };
    const svg = el("svg", { id: "chart" });
    const defs = el("defs");
    const marker = (id: string, refX: number) => {
        const m = el("marker", {
            id,
            viewBox: "0 0 10 6",
            refX,
            refY: 3,
            markerWidth: 10,
            markerHeight: 6,
            markerUnits: "userSpaceOnUse",
            orient: "auto",
            fill: "#808080",
        });
        m.appendChild(el("path", { d: ARROW_PATH }));
        defs.appendChild(m);
    };
    marker("arrow-to-family", 16);
    marker("arrow-to-person", 26);
    const blur = el("filter", { id: "clan-blur", x: "-50%", y: "-50%", width: "200%", height: "200%" });
    blur.appendChild(el("feGaussianBlur", { stdDeviation: 22 }));
    defs.appendChild(blur);
    svg.appendChild(defs);

    const main = el("g", { class: "main" });
    svg.appendChild(main);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x: number, y: number) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    };

    if (model.clans.length) {
        const clans = el("g", { class: "clans" });
        const blobs = el("g", { class: "blobs", filter: "url(#clan-blur)" });
        const labels = el("g", { class: "labels" });
        for (const c of model.clans) {
            blobs.appendChild(el("path", { class: "clan-blob", d: c.path, fill: c.color, opacity: 0.22 }));
            for (const [x, y] of c.hull) grow(x, y);
            const text = el("text", {
                class: "clan-label",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                "font-family": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                "font-weight": 600,
                "letter-spacing": "0.1em",
                fill: "#ffffff",
                opacity: 0.6,
                "font-size": c.fontSize,
                transform: `translate(${c.cx},${c.cy}) rotate(${(c.angle * 180) / Math.PI})`,
            });
            text.textContent = c.label;
            labels.appendChild(text);
        }
        clans.appendChild(blobs);
        clans.appendChild(labels);
        main.appendChild(clans);
    }

    for (const l of model.links) {
        main.appendChild(el("line", {
            x1: l.x1,
            y1: l.y1,
            x2: l.x2,
            y2: l.y2,
            stroke: l.stroke,
            "stroke-width": l.width,
            "marker-end": `url(#arrow-to-${l.arrow})`,
        }));
    }

    for (const n of model.nodes) {
        const g = el("g", { id: n.id, transform: `translate(${n.x},${n.y})` });
        g.appendChild(el("circle", { r: n.r, fill: n.fill }));
        grow(n.x - n.r, n.y - n.r);
        grow(n.x + n.r, n.y + n.r);
        if (n.pinned) g.appendChild(el("path", { class: "pin", d: model.pinPath, transform: "translate(-8.25, -6)", fill: "white" }));
        if (n.type === "person" && n.name && !n.labelHidden) {
            const attrs: Record<string, string | number> = { dx: n.labelDx, dy: n.labelDy, "font-size": model.labelFontSize };
            if (!n.highlighted) attrs.fill = SHADED_TEXT;
            if (n.bold) attrs["font-weight"] = "bold";
            const t = el("text", attrs);
            t.textContent = n.name;
            g.appendChild(t);
            grow(n.x + n.labelDx, n.y + n.labelDy - 15);
            grow(n.x + n.labelDx + n.labelWidth, n.y + n.labelDy + 5);
        }
        main.appendChild(g);
    }

    const bbox: BBox = Number.isFinite(minX)
        ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
        : { x: 0, y: 0, width: 800, height: 600 };
    return { svg, bbox };
}

export function exportChartSvg(model: ExportModel, filename: string): void {
    const { svg, bbox } = buildChartSvgElement(model);
    downloadSvg(buildExportableSvg(svg, bbox), filename);
}
