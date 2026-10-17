import type { ZoomTransform } from "d3";

export type NodeDot = { x: number; y: number; type: "person" | "family" };

export type MinimapBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

export type MinimapLayout = {
    scale: number;
    offsetX: number;
    offsetY: number;
    contentWidth: number;
    contentHeight: number;
};

export type ViewportRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

const PADDING = 8;

export function computeBounds(nodes: NodeDot[]): MinimapBounds {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = nodes[0].x;
    let minY = nodes[0].y;
    let maxX = nodes[0].x;
    let maxY = nodes[0].y;
    for (const n of nodes) {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
    }
    return { minX, minY, maxX, maxY };
}

export function computeLayout(
    bounds: MinimapBounds,
    canvasWidth: number,
    canvasHeight: number,
): MinimapLayout {
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;

    const availW = canvasWidth - PADDING * 2;
    const availH = canvasHeight - PADDING * 2;

    if (contentWidth === 0 && contentHeight === 0) {
        return { scale: 1, offsetX: canvasWidth / 2, offsetY: canvasHeight / 2, contentWidth: 0, contentHeight: 0 };
    }

    const scaleX = contentWidth > 0 ? availW / contentWidth : 1;
    const scaleY = contentHeight > 0 ? availH / contentHeight : 1;
    const scale = Math.min(scaleX, scaleY);

    const scaledW = contentWidth * scale;
    const scaledH = contentHeight * scale;
    const offsetX = PADDING + (availW - scaledW) / 2 - bounds.minX * scale;
    const offsetY = PADDING + (availH - scaledH) / 2 - bounds.minY * scale;

    return { scale, offsetX, offsetY, contentWidth, contentHeight };
}

export function projectNodes(nodes: NodeDot[], layout: MinimapLayout): NodeDot[] {
    return nodes.map((n) => ({
        x: n.x * layout.scale + layout.offsetX,
        y: n.y * layout.scale + layout.offsetY,
        type: n.type,
    }));
}

export type MinimapStyle = { person: string; family: string; viewportFill: string; viewportStroke: string };

export type MinimapSurface = { width: number; height: number; dpr: number };

type MinimapContext = Pick<
    CanvasRenderingContext2D,
    "setTransform" | "clearRect" | "beginPath" | "moveTo" | "arc" | "fill" | "fillRect" | "strokeRect"
> & { fillStyle: unknown; strokeStyle: unknown; lineWidth: number; globalAlpha: number };

const MINIMAP_PERSON_R = 2.5;
const MINIMAP_FAMILY_R = 1.5;

/** Draws the overview on a canvas: one batched path per node type, then the viewport frame. */
export function drawMinimap(
    ctx: MinimapContext,
    rawNodes: NodeDot[],
    layout: MinimapLayout,
    viewport: ViewportRect,
    surface: MinimapSurface,
    style: MinimapStyle,
): void {
    ctx.setTransform(surface.dpr, 0, 0, surface.dpr, 0, 0);
    ctx.clearRect(0, 0, surface.width, surface.height);
    ctx.globalAlpha = 0.7;
    for (const [type, radius, color] of [
        ["person", MINIMAP_PERSON_R, style.person],
        ["family", MINIMAP_FAMILY_R, style.family],
    ] as const) {
        ctx.beginPath();
        for (const n of rawNodes) {
            if (n.type !== type) continue;
            const x = n.x * layout.scale + layout.offsetX;
            const y = n.y * layout.scale + layout.offsetY;
            ctx.moveTo(x + radius, y);
            ctx.arc(x, y, radius, 0, Math.PI * 2);
        }
        ctx.fillStyle = color;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = style.viewportFill;
    ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    ctx.strokeStyle = style.viewportStroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(viewport.x, viewport.y, viewport.width, viewport.height);
}

export function projectViewport(
    transform: ZoomTransform,
    viewWidth: number,
    viewHeight: number,
    layout: MinimapLayout,
): ViewportRect {
    const { k, x: tx, y: ty } = transform;

    const simLeft = -tx / k;
    const simTop = -ty / k;
    const simRight = (viewWidth - tx) / k;
    const simBottom = (viewHeight - ty) / k;

    return {
        x: simLeft * layout.scale + layout.offsetX,
        y: simTop * layout.scale + layout.offsetY,
        width: (simRight - simLeft) * layout.scale,
        height: (simBottom - simTop) * layout.scale,
    };
}

/**
 * Given a pointer click at (clickX, clickY) in minimap-canvas coordinates,
 * returns the new d3 zoom translate [tx, ty] that centres the view on that
 * sim-space point while preserving the current zoom scale.
 */
export function minimapClickToTranslate(
    clickX: number,
    clickY: number,
    layout: MinimapLayout,
    currentTransform: ZoomTransform,
    viewWidth: number,
    viewHeight: number,
): [number, number] {
    const simX = (clickX - layout.offsetX) / layout.scale;
    const simY = (clickY - layout.offsetY) / layout.scale;
    const { k } = currentTransform;
    const tx = viewWidth / 2 - simX * k;
    const ty = viewHeight / 2 - simY * k;
    return [tx, ty];
}
