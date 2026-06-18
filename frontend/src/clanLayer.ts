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

const CLAN_BLUR_ID = "clan-glow-blur";
const MIN_RX = 70;
const MIN_RY = 50;
const MEMBER_BLOB_RADIUS = 70;
const ELLIPSE_PAD = 60;

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
    let defs = svg.select<SVGDefsElement>("defs");
    if (defs.empty()) defs = svg.append("defs");
    if (defs.select(`#${CLAN_BLUR_ID}`).empty()) {
        const filter = defs.append("filter")
            .attr("id", CLAN_BLUR_ID)
            .attr("x", "-50%")
            .attr("y", "-50%")
            .attr("width", "200%")
            .attr("height", "200%");
        filter.append("feGaussianBlur").attr("stdDeviation", 26);
    }
    const main = svg.select("g.main");
    let layer = main.select<SVGGElement>("g.clans");
    if (layer.empty()) {
        layer = main.insert("g", ":first-child").attr("class", "clans");
    }
    layer.attr("pointer-events", "none");
    if (layer.select<SVGGElement>("g.blobs").empty()) layer.append("g").attr("class", "blobs");
    if (layer.select<SVGGElement>("g.labels").empty()) layer.append("g").attr("class", "labels");
    layer.lower();
}

type ClanRenderData = { clan: Clan; points: [number, number][]; shape: ClanShape };

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

    const blobGroups = layer.select("g.blobs")
        .selectAll<SVGGElement, ClanRenderData>("g.clan-blob")
        .data(data, d => d.clan.surname);
    const blobEntering = blobGroups.enter()
        .append("g")
        .attr("class", "clan-blob")
        .attr("filter", `url(#${CLAN_BLUR_ID})`)
        .attr("opacity", 0.22);
    blobGroups.exit().remove();
    const blobsMerged = blobEntering.merge(blobGroups);
    blobsMerged.attr("fill", d => d.clan.color);

    type Spoke = { p: [number, number]; cx: number; cy: number; color: string };
    const spokeData = (d: ClanRenderData): Spoke[] =>
        d.points.map(p => ({ p, cx: d.shape.cx, cy: d.shape.cy, color: d.clan.color }));
    const spokes = blobsMerged.selectAll<SVGPathElement, Spoke>("path.clan-spoke").data(spokeData);
    spokes.enter().append("path").attr("class", "clan-spoke")
        .attr("fill", "none")
        .attr("stroke-width", MEMBER_BLOB_RADIUS * 0.9)
        .attr("stroke-linecap", "round")
        .merge(spokes)
        .attr("stroke", s => s.color)
        .attr("d", s => `M ${s.cx} ${s.cy} L ${s.p[0]} ${s.p[1]}`);
    spokes.exit().remove();

    const memberCircles = blobsMerged.selectAll<SVGCircleElement, [number, number]>("circle")
        .data(d => d.points);
    memberCircles.enter().append("circle")
        .attr("r", MEMBER_BLOB_RADIUS)
        .merge(memberCircles)
        .attr("cx", p => p[0])
        .attr("cy", p => p[1]);
    memberCircles.exit().remove();

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
