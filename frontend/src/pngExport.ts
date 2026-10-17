import { buildChartSvgElement, buildExportableSvg, type ExportModel } from "./svgExport";

const MAX_SIDE = 8192;
const MAX_AREA = 40_000_000;
const PREFERRED_SCALE = 2;

/** Output size for a chart of `width`×`height` world units: 2x when it fits, else shrunk to the canvas limits. */
export function pngExportSize(width: number, height: number): { width: number; height: number; scale: number } {
    const w = Math.max(width, 0);
    const h = Math.max(height, 0);
    let scale = PREFERRED_SCALE;
    if (w > 0 && h > 0) {
        scale = Math.min(scale, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_AREA / (w * h)));
    }
    return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), scale };
}

/** Rasterises the whole chart (not just the viewport) via the SVG export model and downloads a PNG. */
export async function exportChartPng(model: ExportModel, filename: string): Promise<void> {
    const { svg, bbox } = buildChartSvgElement(model);
    const source = buildExportableSvg(svg, bbox);
    const doc = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
    const [, , vbW, vbH] = (doc.getAttribute("viewBox") ?? "0 0 1 1").split(/\s+/).map(Number);
    const size = pngExportSize(vbW, vbH);
    doc.setAttribute("width", String(size.width));
    doc.setAttribute("height", String(size.height));

    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: "image/svg+xml" }));
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("could not render the chart image"));
            image.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas is not available");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size.width, size.height);
        ctx.drawImage(img, 0, 0, size.width, size.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("could not encode the PNG");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 0);
    } finally {
        URL.revokeObjectURL(url);
    }
}
