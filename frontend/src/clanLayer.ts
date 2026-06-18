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

export function initClanLayer(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>) {
    const main = svg.select("g.main");
    let layer = main.select<SVGGElement>("g.clans");
    if (layer.empty()) {
        layer = main.insert("g", ":first-child").attr("class", "clans");
    }
    layer.attr("pointer-events", "none");
    // CSS filter on the layer is GPU-accelerated; per-element feGaussianBlur on
    // many paths locked Chrome's main thread on large stemmas.
    let blobs = layer.select<SVGGElement>("g.blobs");
    if (blobs.empty()) blobs = layer.append("g").attr("class", "blobs");
    blobs.style("filter", `blur(${LAYER_BLUR_PX}px)`);
    if (layer.select<SVGGElement>("g.labels").empty()) layer.append("g").attr("class", "labels");
    layer.lower();
}

type ClanRenderData = { clan: Clan; points: [number, number][]; shape: ClanShape };

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

export function updateClanLayer(
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
    clans: ReadonlyArray<Clan>,
    nodes: ReadonlyArray<ClanNodePosition>,
) {
    const layer = svg.select<SVGGElement>("g.main > g.clans");
    if (layer.empty()) return;
    layer.lower();

    const positionById = new Map<string, [number, number]>();
    for (const n of nodes) positionById.set(n.id, [n.x, n.y]);

    const data: ClanRenderData[] = clans
        .map(clan => {
            const points: [number, number][] = [];
            for (const pid of clan.personIds) {
                const pos = positionById.get(normalizeId("person", pid));
                if (pos) points.push(pos);
            }
            if (points.length < 2) return null;
            return { clan, points, shape: clanShape(points) };
        })
        .filter((x): x is ClanRenderData => x !== null);

    const pathGen = d3.line<[number, number]>()
        .x(p => p[0])
        .y(p => p[1])
        .curve(d3.curveCatmullRomClosed.alpha(0.7));

    const blobs = layer.select("g.blobs")
        .selectAll<SVGPathElement, ClanRenderData>("path.clan-blob")
        .data(data, d => d.clan.surname);
    blobs.enter()
        .append("path")
        .attr("class", "clan-blob")
        .attr("opacity", 0.32)
        .merge(blobs)
        .attr("fill", d => d.clan.color)
        .attr("d", d => pathGen(paddedHull(d.points, d.shape)) ?? "");
    blobs.exit().remove();

    const labels = layer.select("g.labels")
        .selectAll<SVGTextElement, ClanRenderData>("text.clan-label")
        .data(data, d => d.clan.surname);
    const labelEntering = labels.enter().append("text").attr("class", "clan-label");
    labels.exit().remove();
    const labelsMerged = labelEntering.merge(labels);
    labelsMerged
        .text(d => d.clan.plural.toUpperCase())
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-family", "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace")
        .attr("font-weight", "600")
        .attr("font-style", "normal")
        .attr("letter-spacing", "0.1em")
        .attr("fill", "#ffffff")
        .attr("opacity", 0.7)
        .attr("pointer-events", "none")
        .attr("transform", d => {
            const deg = (d.shape.angle * 180) / Math.PI;
            return `translate(${d.shape.cx},${d.shape.cy}) rotate(${deg})`;
        })
        .attr("font-size", d => {
            const len = Math.max(1, d.clan.plural.length);
            const widthFit = (d.shape.rx * 0.6) / (len * 0.6);
            const heightFit = d.shape.ry * 0.25;
            return Math.max(11, Math.min(widthFit, heightFit, 36));
        })
        .attr("textLength", null)
        .attr("lengthAdjust", null);
}
