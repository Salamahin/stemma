import * as d3 from "d3";
import type { Clan } from "./clans";
import { normalizeId } from "./graphTools";

export type ClanShape = {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    angle: number;
};

export type ClanNodePosition = { id: string; x: number; y: number };

const MIN_RX = 70;
const MIN_RY = 50;
const ELLIPSE_PAD = 60;
const LAYER_BLUR_PX = 22;
const HULL_PADDING = 55;
const LABEL_BASELINE_FONT_PX = 16;
const LABEL_FIT_FRACTION = 0.8;
const LABEL_MIN_FONT_PX = 11;

// In the label's local frame (centered at cx,cy, rotated by -angle), find the
// largest centered axis-aligned rectangle that fits inside the hull. Returns
// half-extents so callers can compare against text bbox half-width/height.
export function inscribedHalfExtents(
    hull: ReadonlyArray<readonly [number, number]>,
    cx: number,
    cy: number,
    angle: number,
): { halfW: number; halfH: number } {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let maxX = 0, minX = 0, maxY = 0, minY = 0;
    let first = true;
    for (const [x, y] of hull) {
        const dx = x - cx;
        const dy = y - cy;
        const lx = cos * dx + sin * dy;
        const ly = -sin * dx + cos * dy;
        if (first) {
            maxX = minX = lx;
            maxY = minY = ly;
            first = false;
            continue;
        }
        if (lx > maxX) maxX = lx;
        if (lx < minX) minX = lx;
        if (ly > maxY) maxY = ly;
        if (ly < minY) minY = ly;
    }
    return {
        halfW: Math.max(0, Math.min(maxX, -minX)),
        halfH: Math.max(0, Math.min(maxY, -minY)),
    };
}

export function clanShape(positions: ReadonlyArray<readonly [number, number]>): ClanShape {
    const n = positions.length;
    if (n === 0) return { cx: 0, cy: 0, rx: MIN_RX, ry: MIN_RY, angle: 0 };
    let cx = 0;
    let cy = 0;
    for (const [x, y] of positions) {
        cx += x;
        cy += y;
    }
    cx /= n;
    cy /= n;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const [x, y] of positions) {
        const dx = x - cx;
        const dy = y - cy;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
    }
    sxx /= n;
    syy /= n;
    sxy /= n;
    const tr = sxx + syy;
    const det = sxx * syy - sxy * sxy;
    const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + disc;
    const l2 = tr / 2 - disc;
    const rawAngle = Math.abs(sxy) < 1e-9 && Math.abs(sxx - syy) < 1e-9
        ? 0
        : Math.atan2(l1 - sxx, sxy);
    const angle = rawAngle > Math.PI / 2 ? rawAngle - Math.PI
        : rawAngle < -Math.PI / 2 ? rawAngle + Math.PI
        : rawAngle;
    const rx = Math.max(MIN_RX, 2 * Math.sqrt(Math.max(0, l1)) + ELLIPSE_PAD);
    const ry = Math.max(MIN_RY, 2 * Math.sqrt(Math.max(0, l2)) + ELLIPSE_PAD);
    return { cx, cy, rx, ry, angle };
}


// Compute a convex hull around the points, then push every hull vertex outward
// from the cluster centroid by HULL_PADDING so the blob extends beyond the nodes.
// Collinear or near-degenerate hulls fall back to an ellipse-shaped 12-gon.
export function paddedHull(
    points: ReadonlyArray<[number, number]>,
    shape: ClanShape,
): Array<[number, number]> {
    const hull = points.length >= 3 ? d3.polygonHull(points.map(p => [p[0], p[1]] as [number, number])) : null;
    if (hull && hull.length >= 3) {
        return hull.map(([x, y]) => {
            const dx = x - shape.cx;
            const dy = y - shape.cy;
            const dist = Math.hypot(dx, dy) || 1;
            const k = (dist + HULL_PADDING) / dist;
            return [shape.cx + dx * k, shape.cy + dy * k] as [number, number];
        });
    }
    // Fallback: sample an ellipse from PCA shape so the blob still renders.
    const steps = 12;
    const ring: Array<[number, number]> = [];
    const cos = Math.cos(shape.angle);
    const sin = Math.sin(shape.angle);
    for (let i = 0; i < steps; i++) {
        const t = (i / steps) * 2 * Math.PI;
        const lx = Math.cos(t) * shape.rx;
        const ly = Math.sin(t) * shape.ry;
        ring.push([shape.cx + lx * cos - ly * sin, shape.cy + lx * sin + ly * cos]);
    }
    return ring;
}

export type ClanRenderData = {
    clan: Clan;
    points: [number, number][];
    shape: ClanShape;
    hull: [number, number][];
    /** Font size (px, user space) at which the label fits inside the hull. */
    labelFontSize: number;
};

export const CLAN_BLOB_OPACITY = 0.22;
export const CLAN_LABEL_OPACITY = 0.6;
export const CLAN_LABEL_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const CLAN_LABEL_LETTER_SPACING_EM = 0.1;
export { LAYER_BLUR_PX as CLAN_BLUR_PX, LABEL_BASELINE_FONT_PX as CLAN_LABEL_BASELINE_FONT_PX };

export function clanLabelText(clan: Clan): string {
    return clan.surname.toUpperCase();
}

/**
 * Scale the label font so the text fits inside the blob on both axes, measured
 * in the label's local rotated frame. `measure` returns the label's width and
 * height at LABEL_BASELINE_FONT_PX.
 */
export function fitClanLabelFont(
    hull: ReadonlyArray<readonly [number, number]>,
    shape: ClanShape,
    measured: { width: number; height: number },
): number {
    if (measured.width <= 0 || measured.height <= 0) return LABEL_BASELINE_FONT_PX;
    const { halfW, halfH } = inscribedHalfExtents(hull, shape.cx, shape.cy, shape.angle);
    const maxW = 2 * halfW * LABEL_FIT_FRACTION;
    const maxH = 2 * halfH * LABEL_FIT_FRACTION;
    const scale = Math.min(maxW / measured.width, maxH / measured.height);
    return Math.max(LABEL_MIN_FONT_PX, LABEL_BASELINE_FONT_PX * scale);
}

/** Smooth closed outline through the padded hull (same curve as the old SVG path). */
export function clanBlobPath(hull: Array<[number, number]>, context: CanvasRenderingContext2D | null = null): string | null {
    const gen = d3.line<[number, number]>()
        .x(p => p[0])
        .y(p => p[1])
        .curve(d3.curveCatmullRomClosed.alpha(0.7));
    if (context) {
        gen.context(context);
        gen(hull);
        return null;
    }
    return gen(hull) ?? "";
}

export function computeClanRenderData(
    clans: ReadonlyArray<Clan>,
    nodes: ReadonlyArray<ClanNodePosition>,
    measureLabel: (text: string) => { width: number; height: number },
): ClanRenderData[] {
    const positionById = new Map<string, [number, number]>();
    for (const n of nodes) positionById.set(n.id, [n.x, n.y]);

    const out: ClanRenderData[] = [];
    for (const clan of clans) {
        const points: [number, number][] = [];
        for (const pid of clan.personIds) {
            const pos = positionById.get(normalizeId("person", pid));
            if (pos) points.push(pos);
        }
        if (points.length < 2) continue;
        const shape = clanShape(points);
        const hull = paddedHull(points, shape);
        const labelFontSize = fitClanLabelFont(hull, shape, measureLabel(clanLabelText(clan)));
        out.push({ clan, points, shape, hull, labelFontSize });
    }
    return out;
}
