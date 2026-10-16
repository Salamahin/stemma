/**
 * Canvas2D renderer for the family graph.
 *
 * Replaces the old per-node SVG DOM. Draws only on demand (one rAF per
 * invalidation: sim tick, zoom, hover, style change, running animation),
 * batches edges/arrows into a handful of paths, culls off-screen nodes, caches
 * the blurred clan "clouds" in an offscreen bitmap and hit-tests through a
 * quadtree instead of the DOM.
 */
import * as d3 from "d3";
import { placeLabels } from "./labelLayout";
import {
    personR,
    familyR,
    defaultFamilyColor,
    shadedNodeColor,
    relationsColor,
    shadedRelationColor,
    childRelationWidth,
    familyRelationWidth,
    shadedRelationWidth,
    labelFontSize,
    personColor,
    arrowPath,
} from "./graphStyles";
import { denormalizeId } from "./graphTools";
import type { Clan } from "./clans";
import {
    computeClanRenderData,
    clanBlobPath,
    clanLabelText,
    CLAN_BLOB_OPACITY,
    CLAN_BLUR_PX,
    CLAN_LABEL_BASELINE_FONT_PX,
    CLAN_LABEL_FONT_FAMILY,
    CLAN_LABEL_LETTER_SPACING_EM,
    CLAN_LABEL_OPACITY,
    type ClanRenderData,
} from "./clanLayer";
import { trimToCircle, GHOST_EDGE_GAP } from "./ghostEdgeGeometry";

export type NodeType = "person" | "family";

export type ChartNode = {
    id: string;
    type: NodeType;
    name?: string;
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
    index?: number;
    fixed?: boolean;
    hadKnownPosition?: boolean;
    r?: number;
    /** Label offset from the node centre (text start, baseline). */
    labelDx?: number;
    labelDy?: number;
    labelHidden?: boolean;
};

export type LinkType = "familyToChild" | "spouseToFamily";

export type ChartLink = {
    id: string;
    source: ChartNode | string;
    target: ChartNode | string;
    type: LinkType;
};

export type Highlighter = {
    personIsHighlighted(personId: string): boolean;
    familyIsHighlighted(familyId: string): boolean;
};

export type GenerationIndex = {
    lineage(personId: string): { generation: number };
    maxGeneration(): number;
};

export type GhostNodeView = {
    id: string;
    type: "ghost-person" | "ghost-family";
    x: number;
    y: number;
    color?: string;
    label?: string;
};

export type GhostEdgeView = {
    sourceId: string;
    targetId: string;
    edgeKind: "focusToFamily" | "familyToPerson";
};

export type GhostSet = { nodes: GhostNodeView[]; edges: GhostEdgeView[] };

export type GestureOverlay = {
    line?: { x1: number; y1: number; x2: number; y2: number } | null;
    sourceMarker?: { x: number; y: number } | null;
    preview?: { x: number; y: number; r: number } | null;
};

export type DropClass = "drop-allowed" | "drop-disallowed";

export type ArrowKind = "person" | "family";

export function arrowKindFor(type: LinkType): ArrowKind {
    return type === "familyToChild" ? "person" : "family";
}

// Arrow marker geometry (viewBox 0 0 10 6, userSpaceOnUse, refY 3): the point
// (refX, 3) of the marker sits on the line end.
const ARROW_REF_X: Record<ArrowKind, number> = { family: 16, person: 26 };
const GHOST_ARROW_REF_X = 10;

const HOVERED_PERSON_R = 25;
const HOVERED_FAMILY_R = 10;
const LABEL_DX = -personR;
const LABEL_DY = 40;
const LABEL_FONT_PX = parseFloat(labelFontSize);
const TEXT_COLOR = "#000";

const GHOST_COLOR = "#6c757d";
const GHOST_FADE_MS = 200;
const ACCENT = "#0d6efd";
const PENDING_REMOVE_COLOR = "#dc3545";

const PIN_PATH =
    "M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z";

/** Max side (device px) of the offscreen bitmap holding the blurred clan clouds. */
const CLAN_BITMAP_MAX = 2048;
/** Below this on-screen font size labels are unreadable; skip drawing them. */
const MIN_LABEL_SCREEN_PX = 2.5;

const px = (v: string) => parseFloat(v);

function pulse(now: number, periodMs: number, low: number): number {
    // ease-in-out between 1 and `low` and back, like the CSS keyframes.
    const t = (now % periodMs) / periodMs;
    const phase = t < 0.5 ? t * 2 : (1 - t) * 2;
    const eased = phase < 0.5 ? 2 * phase * phase : 1 - Math.pow(-2 * phase + 2, 2) / 2;
    return 1 + (low - 1) * eased;
}

function desaturate(color: string, amount: number): string {
    const c = d3.hsl(color);
    if (Number.isNaN(c.s)) return color;
    c.s *= amount;
    return c.formatRgb();
}

type GhostLayerState = { set: GhostSet; born: number; dying: number | null };

export type ChartSnapshotNode = {
    id: string;
    type: NodeType;
    name: string | null;
    x: number;
    y: number;
    r: number;
    drawn: boolean;
    pending: boolean;
    clientX: number;
    clientY: number;
};

export class CanvasChart {
    readonly canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private dpr = 1;
    private cssWidth = 0;
    private cssHeight = 0;
    private fontFamily = "sans-serif";

    transform: d3.ZoomTransform = d3.zoomIdentity;

    nodes: ChartNode[] = [];
    links: ChartLink[] = [];
    private nodeById = new Map<string, ChartNode>();
    private drawnIds = new Set<string>();

    // style inputs
    private highlight: Highlighter | null = null;
    private generations: GenerationIndex | null = null;
    private pinnedPersonIds = new Set<string>();
    private hoveredId: string | null = null;
    private pendingAdd = new Set<string>();
    private pendingRemove = new Set<string>();
    private dropClasses = new Map<string, DropClass>();
    private dropTargetId: string | null = null;
    private gestureSourceId: string | null = null;
    private overlay: GestureOverlay = {};
    private ghostLayers: GhostLayerState[] = [];
    private hoveredGhostId: string | null = null;

    // derived style caches
    private fillById = new Map<string, string>();
    private highlightedIds = new Set<string>();

    // clans
    private clans: ReadonlyArray<Clan> = [];
    private clanData: ClanRenderData[] = [];
    private clanBitmap: HTMLCanvasElement | null = null;
    private clanBitmapScratch: HTMLCanvasElement | null = null;
    private clanBitmapRect = { x: 0, y: 0, w: 0, h: 0 };

    // hit testing
    private quadtree: d3.Quadtree<ChartNode> | null = null;
    private quadtreeDirty = true;
    private labelWidthCache = new Map<string, number>();

    private frameRequested = false;
    private destroyed = false;
    private lastStats = { edges: 0, arrows: 0, nodes: 0 };
    private pinPath: Path2D | null = null;
    private arrowPath2D: Path2D | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private dprQuery: MediaQueryList | null = null;

    onResize: (() => void) | null = null;
    /** performance.now() of the first frame that drew any node (benchmarks). */
    firstDrawAt = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        this.ctx = ctx;
        try {
            this.fontFamily = getComputedStyle(canvas).fontFamily || this.fontFamily;
        } catch {
            // keep default
        }
        if (typeof Path2D !== "undefined") {
            this.pinPath = new Path2D(PIN_PATH);
            this.arrowPath2D = new Path2D(arrowPath);
        }
        this.resize();
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(canvas);
        }
        this.watchDpr();
    }

    destroy() {
        this.destroyed = true;
        this.resizeObserver?.disconnect();
        this.dprQuery?.removeEventListener?.("change", this.onDprChange);
    }

    private onDprChange = () => {
        this.resize();
        this.watchDpr();
    };

    private watchDpr() {
        if (typeof window === "undefined" || !window.matchMedia) return;
        this.dprQuery?.removeEventListener?.("change", this.onDprChange);
        this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        this.dprQuery.addEventListener?.("change", this.onDprChange);
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
        const w = Math.max(1, Math.round(rect.width));
        const h = Math.max(1, Math.round(rect.height));
        if (w === this.cssWidth && h === this.cssHeight && dpr === this.dpr) return;
        this.cssWidth = w;
        this.cssHeight = h;
        this.dpr = dpr;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.onResize?.();
        this.requestRender();
    }

    // ---------------------------------------------------------------- data

    setData(nodes: ChartNode[], links: ChartLink[]) {
        this.nodes = nodes;
        this.links = links;
        this.nodeById = new Map(nodes.map((n) => [n.id, n]));
        for (const n of nodes) {
            if (n.labelDx == null) n.labelDx = LABEL_DX;
            if (n.labelDy == null) n.labelDy = LABEL_DY;
        }
        if (this.hoveredId && !this.nodeById.has(this.hoveredId)) this.hoveredId = null;
        this.restyle();
        this.positionsChanged();
    }

    node(id: string): ChartNode | undefined {
        return this.nodeById.get(id);
    }

    private positionListeners = new Set<() => void>();

    /** Subscribe to node movement (layout batches, drags); returns an unsubscribe. */
    onPositionsChanged(fn: () => void): () => void {
        this.positionListeners.add(fn);
        return () => this.positionListeners.delete(fn);
    }

    /** Positions moved (sim tick, manual placement). */
    positionsChanged() {
        this.quadtreeDirty = true;
        this.requestRender();
        for (const fn of this.positionListeners) fn();
    }

    setStyleInputs(highlight: Highlighter | null, generations: GenerationIndex | null, pinnedPersonIds: Iterable<string>) {
        this.highlight = highlight;
        this.generations = generations;
        this.pinnedPersonIds = new Set(pinnedPersonIds);
        this.restyle();
    }

    /** Recompute per-node fill/highlight after the highlight set changed. */
    restyle() {
        this.fillById.clear();
        this.highlightedIds.clear();
        const hl = this.highlight;
        const gen = this.generations;
        const maxGen = gen ? gen.maxGeneration() : 0;
        for (const n of this.nodes) {
            const rawId = denormalizeId(n.id);
            if (n.type === "person") {
                const on = hl ? hl.personIsHighlighted(rawId) : true;
                if (on) this.highlightedIds.add(n.id);
                const ratio = gen ? gen.lineage(rawId).generation / maxGen : 0;
                this.fillById.set(n.id, on ? personColor(ratio) : shadedNodeColor);
            } else {
                const on = hl ? hl.familyIsHighlighted(rawId) : true;
                if (on) this.highlightedIds.add(n.id);
                this.fillById.set(n.id, on ? defaultFamilyColor : shadedNodeColor);
            }
        }
        this.requestRender();
    }

    setHovered(id: string | null) {
        if (this.hoveredId === id) return;
        this.hoveredId = id;
        this.quadtreeDirty = true;
        this.requestRender();
    }

    getHovered(): string | null {
        return this.hoveredId;
    }

    setPendingMarks(add: Iterable<string>, remove: Iterable<string>) {
        this.pendingAdd = new Set(add);
        this.pendingRemove = new Set(remove);
        this.requestRender();
    }

    setDropClasses(classes: Map<string, DropClass>) {
        this.dropClasses = classes;
        this.requestRender();
    }

    setDropTarget(id: string | null) {
        if (this.dropTargetId === id) return;
        this.dropTargetId = id;
        this.requestRender();
    }

    setGestureSource(id: string | null) {
        if (this.gestureSourceId === id) return;
        this.gestureSourceId = id;
        this.requestRender();
    }

    setOverlay(overlay: GestureOverlay) {
        this.overlay = overlay;
        this.requestRender();
    }

    /** Shows a ghost set (fades in); returns a disposer that fades it out. */
    showGhosts(set: GhostSet): () => void {
        const layer: GhostLayerState = { set, born: performance.now(), dying: null };
        this.ghostLayers.push(layer);
        this.requestRender();
        return () => {
            if (layer.dying != null) return;
            layer.dying = performance.now();
            if (this.hoveredGhostId && set.nodes.some((n) => n.id === this.hoveredGhostId)) this.hoveredGhostId = null;
            this.requestRender();
        };
    }

    setClans(clans: ReadonlyArray<Clan>) {
        this.clans = clans;
        this.updateClans();
    }

    /** Recompute clan hulls from current positions and re-rasterize the blurred clouds. */
    updateClans() {
        this.clanData = computeClanRenderData(this.clans, this.nodes, (text) => this.measureClanLabel(text, CLAN_LABEL_BASELINE_FONT_PX));
        this.rasterizeClans();
        this.requestRender();
    }

    // ---------------------------------------------------------- geometry

    get width() {
        return this.cssWidth;
    }

    get height() {
        return this.cssHeight;
    }

    clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const [x, y] = this.transform.invert([clientX - rect.left, clientY - rect.top]);
        return { x, y };
    }

    worldToClient(x: number, y: number): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const [sx, sy] = this.transform.apply([x, y]);
        return { x: sx + rect.left, y: sy + rect.top };
    }

    nodeRadius(n: ChartNode): number {
        if (n.type === "person") return n.id === this.hoveredId ? HOVERED_PERSON_R : personR;
        return n.id === this.hoveredId ? HOVERED_FAMILY_R : familyR;
    }

    /** Client-space bounding rect of a node's circle (anchors popovers). */
    nodeClientRect(id: string): DOMRect {
        const n = this.nodeById.get(id);
        if (!n) return new DOMRect(-1e4, -1e4, 0, 0);
        const c = this.worldToClient(n.x, n.y);
        const r = this.nodeRadius(n) * this.transform.k;
        return new DOMRect(c.x - r, c.y - r, 2 * r, 2 * r);
    }

    private labelWidth(name: string, bold = false): number {
        const key = (bold ? "b:" : "n:") + name;
        let w = this.labelWidthCache.get(key);
        if (w == null) {
            this.ctx.font = this.labelFont(bold);
            w = this.ctx.measureText(name).width;
            this.labelWidthCache.set(key, w);
        }
        return w;
    }

    private labelFont(bold: boolean): string {
        return `${bold ? "bold " : ""}${LABEL_FONT_PX}px ${this.fontFamily}`;
    }

    private measureClanLabel(text: string, fontPx: number): { width: number; height: number } {
        this.ctx.font = `600 ${fontPx}px ${CLAN_LABEL_FONT_FAMILY}`;
        const width = this.ctx.measureText(text).width + text.length * CLAN_LABEL_LETTER_SPACING_EM * fontPx;
        return { width, height: fontPx * 1.2 };
    }

    private ensureQuadtree() {
        if (!this.quadtreeDirty && this.quadtree) return;
        this.quadtree = d3
            .quadtree<ChartNode>()
            .x((d) => d.x)
            .y((d) => d.y)
            .addAll(this.nodes.filter((n) => n.x != null && n.y != null));
        this.quadtreeDirty = false;
    }

    /**
     * Topmost real node under a client point: its circle, or (for people) its
     * name label — the same hit area the SVG <g> used to have.
     */
    hitNode(clientX: number, clientY: number, opts: { skip?: (n: ChartNode) => boolean } = {}): ChartNode | null {
        const p = this.clientToWorld(clientX, clientY);
        return this.hitNodeWorld(p.x, p.y, opts);
    }

    hitNodeWorld(x: number, y: number, opts: { skip?: (n: ChartNode) => boolean } = {}): ChartNode | null {
        this.ensureQuadtree();
        const qt = this.quadtree!;
        const reachX = 400;
        const reachY = 80;
        const candidates: ChartNode[] = [];
        qt.visit((q, x0, y0, x1, y1) => {
            if (!q.length) {
                let leaf: any = q;
                do {
                    candidates.push(leaf.data);
                    leaf = leaf.next;
                } while (leaf);
            }
            return x0 > x + reachX || x1 < x - reachX || y0 > y + reachY || y1 < y - reachY;
        });
        if (candidates.length === 0) return null;
        const order = (n: ChartNode) => n.index ?? this.nodes.indexOf(n);
        candidates.sort((a, b) => order(b) - order(a));
        // Labels are painted above every circle, so they win first.
        for (const n of candidates) {
            if (n.type !== "person" || n.labelHidden || !n.name) continue;
            if (opts.skip?.(n)) continue;
            const bold = n.id === this.hoveredId;
            const w = this.labelWidth(n.name, bold);
            const lx = n.x + (n.labelDx ?? LABEL_DX);
            const ly = n.y + (n.labelDy ?? LABEL_DY);
            if (x >= lx && x <= lx + w && y >= ly - LABEL_FONT_PX * 0.8 && y <= ly + LABEL_FONT_PX * 0.25) return n;
        }
        for (const n of candidates) {
            if (opts.skip?.(n)) continue;
            const r = this.nodeRadius(n);
            const dx = x - n.x;
            const dy = y - n.y;
            if (dx * dx + dy * dy <= r * r) return n;
        }
        return null;
    }

    /** Ghost person under a client point (ghost families are not interactive). */
    hitGhost(clientX: number, clientY: number): GhostNodeView | null {
        const p = this.clientToWorld(clientX, clientY);
        for (let i = this.ghostLayers.length - 1; i >= 0; i--) {
            const layer = this.ghostLayers[i];
            if (layer.dying != null) continue;
            for (const g of layer.set.nodes) {
                if (g.type !== "ghost-person") continue;
                if (Math.hypot(g.x - p.x, g.y - p.y) <= personR + 0.75) return g;
            }
        }
        return null;
    }

    setHoveredGhost(id: string | null) {
        if (this.hoveredGhostId === id) return;
        this.hoveredGhostId = id;
        this.requestRender();
    }

    // ------------------------------------------------------- label layout

    /** Greedy non-overlapping placement of person labels (runs when the sim settles). */
    layoutLabels() {
        const persons = this.nodes.filter((n) => n.type === "person");
        if (persons.length === 0) return;
        const h = LABEL_FONT_PX * 1.2 + 4;
        const rects = persons.map((p) => {
            const w = (p.name ? this.labelWidth(p.name) : 76) + 4;
            return { x: p.x - personR, y: p.y + 20, width: w, height: h };
        });
        const placed = placeLabels(rects);
        persons.forEach((p, i) => {
            const slot = placed[i];
            p.labelDx = slot.x - p.x;
            p.labelDy = slot.y - p.y + h * 0.7;
            p.labelHidden = !!slot.hidden;
        });
        this.requestRender();
    }

    // ------------------------------------------------------------ clans

    private rasterizeClans() {
        if (typeof document === "undefined") return;
        if (this.clanData.length === 0) {
            this.clanBitmapRect = { x: 0, y: 0, w: 0, h: 0 };
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const d of this.clanData) {
            for (const [x, y] of d.hull) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
        const margin = CLAN_BLUR_PX * 3;
        minX -= margin;
        minY -= margin;
        maxX += margin;
        maxY += margin;
        const ww = maxX - minX;
        const wh = maxY - minY;
        const scale = Math.min(1, CLAN_BITMAP_MAX / Math.max(ww, wh));
        const bw = Math.max(1, Math.ceil(ww * scale));
        const bh = Math.max(1, Math.ceil(wh * scale));

        const sharp = (this.clanBitmapScratch ??= document.createElement("canvas"));
        const blurred = (this.clanBitmap ??= document.createElement("canvas"));
        const filterSupported = "filter" in (this.ctx as any);
        // Without ctx.filter, draw at 1/8 resolution and let bilinear upscaling soften the edges.
        const fallbackScale = filterSupported ? 1 : 1 / 8;
        sharp.width = Math.max(1, Math.ceil(bw * fallbackScale));
        sharp.height = Math.max(1, Math.ceil(bh * fallbackScale));
        blurred.width = bw;
        blurred.height = bh;
        const sctx = sharp.getContext("2d");
        const bctx = blurred.getContext("2d");
        if (!sctx || !bctx) return;
        const s = scale * fallbackScale;
        sctx.setTransform(s, 0, 0, s, -minX * s, -minY * s);
        sctx.clearRect(minX, minY, ww, wh);
        for (const d of this.clanData) {
            sctx.globalAlpha = CLAN_BLOB_OPACITY;
            sctx.fillStyle = d.clan.color;
            sctx.beginPath();
            clanBlobPath(d.hull, sctx);
            sctx.fill();
        }
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.clearRect(0, 0, bw, bh);
        if (filterSupported) (bctx as any).filter = `blur(${CLAN_BLUR_PX * scale}px)`;
        bctx.imageSmoothingEnabled = true;
        bctx.drawImage(sharp, 0, 0, bw, bh);
        if (filterSupported) (bctx as any).filter = "none";
        this.clanBitmapRect = { x: minX, y: minY, w: ww, h: wh };
    }

    // ------------------------------------------------------------ render

    requestRender() {
        if (this.frameRequested || this.destroyed) return;
        this.frameRequested = true;
        requestAnimationFrame(() => {
            this.frameRequested = false;
            if (!this.destroyed) this.render();
        });
    }

    render() {
        const now = performance.now();
        const ctx = this.ctx;
        const t = this.transform;
        const dpr = this.dpr;
        let animating = false;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(dpr * t.k, 0, 0, dpr * t.k, dpr * t.x, dpr * t.y);

        // visible world rect (with margin for labels)
        const [vx0, vy0] = t.invert([-200, -100]);
        const [vx1, vy1] = t.invert([this.cssWidth + 50, this.cssHeight + 100]);
        const visible = (x: number, y: number) => x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1;

        // 1. clan clouds + labels
        if (this.clanBitmap && this.clanBitmapRect.w > 0) {
            const r = this.clanBitmapRect;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(this.clanBitmap, r.x, r.y, r.w, r.h);
        }
        for (const d of this.clanData) this.drawClanLabel(d);

        // 2. edges, batched by style
        const highlightedLink = (l: ChartLink) => {
            const s = l.source as ChartNode;
            const tt = l.target as ChartNode;
            const fam = this.highlightedFamilyEnd(s) || this.highlightedFamilyEnd(tt);
            const ppl = this.highlightedPersonEnd(s) || this.highlightedPersonEnd(tt);
            return fam && ppl;
        };
        const groups = new Map<string, { color: string; width: number; path: Path2D | null; segs: number[] }>();
        const arrows: number[] = [];
        let edgeCount = 0;
        for (const l of this.links) {
            const s = l.source as ChartNode;
            const tt = l.target as ChartNode;
            if (typeof s !== "object" || typeof tt !== "object") continue;
            if (!visible(s.x, s.y) && !visible(tt.x, tt.y) && !this.segmentCrossesView(s, tt, vx0, vy0, vx1, vy1)) continue;
            const on = highlightedLink(l);
            const color = on ? relationsColor : shadedRelationColor;
            const width = on ? (l.type === "familyToChild" ? px(childRelationWidth) : px(familyRelationWidth)) : px(shadedRelationWidth);
            const key = color + "|" + width;
            let g = groups.get(key);
            if (!g) {
                g = { color, width, path: null, segs: [] };
                groups.set(key, g);
            }
            g.segs.push(s.x, s.y, tt.x, tt.y);
            arrows.push(s.x, s.y, tt.x, tt.y, ARROW_REF_X[arrowKindFor(l.type)]);
            edgeCount++;
        }
        ctx.lineCap = "butt";
        for (const g of groups.values()) {
            ctx.beginPath();
            const a = g.segs;
            for (let i = 0; i < a.length; i += 4) {
                ctx.moveTo(a[i], a[i + 1]);
                ctx.lineTo(a[i + 2], a[i + 3]);
            }
            ctx.strokeStyle = g.color;
            ctx.lineWidth = g.width;
            ctx.stroke();
        }
        ctx.beginPath();
        let arrowCount = 0;
        for (let i = 0; i < arrows.length; i += 5) {
            if (this.addArrow(ctx, arrows[i], arrows[i + 1], arrows[i + 2], arrows[i + 3], arrows[i + 4])) arrowCount++;
        }
        ctx.fillStyle = relationsColor;
        ctx.fill();

        // 3. node circles
        this.drawnIds.clear();
        const drawLabels = LABEL_FONT_PX * t.k >= MIN_LABEL_SCREEN_PX;
        const pendingPulse = pulse(now, 1200, 0.35);
        const dropPulse = pulse(now, 1800, 0.45);
        for (const n of this.nodes) {
            if (n.x == null || n.y == null || !visible(n.x, n.y)) continue;
            this.drawnIds.add(n.id);
            const disallowed = this.dropClasses.get(n.id) === "drop-disallowed";
            let fill = this.fillById.get(n.id) ?? shadedNodeColor;
            if (disallowed) fill = desaturate(fill, 0.2);
            const r = this.nodeRadius(n);
            const groupAlpha = disallowed ? 0.3 : 1;
            const pendingAdd = this.pendingAdd.has(n.id);
            const pendingRemove = this.pendingRemove.has(n.id);
            ctx.globalAlpha = groupAlpha * (pendingAdd || pendingRemove ? 0.45 : 1);
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fillStyle = fill;
            ctx.fill();
            if (pendingAdd || pendingRemove) {
                animating = true;
                ctx.setLineDash(pendingRemove ? [4, 4] : [4, 3]);
                ctx.strokeStyle = pendingRemove ? PENDING_REMOVE_COLOR : ACCENT;
                ctx.lineWidth = 1;
                ctx.globalAlpha = groupAlpha * 0.45 * pendingPulse;
                ctx.stroke();
                ctx.setLineDash([]);
            }
            if (n.id === this.gestureSourceId || n.id === this.dropTargetId) {
                const isTarget = n.id === this.dropTargetId;
                ctx.save();
                ctx.shadowColor = isTarget ? "rgba(13, 110, 253, 0.55)" : "rgba(13, 110, 253, 0.65)";
                ctx.shadowBlur = (isTarget ? 6 : 8) * t.k * this.dpr;
                ctx.strokeStyle = ACCENT;
                ctx.lineWidth = isTarget ? 3 : 2.5;
                if (isTarget) ctx.setLineDash([4, 2]);
                let a = groupAlpha;
                if (this.dropClasses.get(n.id) === "drop-allowed") {
                    a *= dropPulse;
                    animating = true;
                }
                ctx.globalAlpha = a;
                ctx.stroke();
                ctx.restore();
            }
            if (n.type === "person" && this.pinPath && this.pinnedPersonIds.has(denormalizeId(n.id))) {
                ctx.globalAlpha = groupAlpha;
                ctx.save();
                ctx.translate(n.x - 8.25, n.y - 6);
                ctx.fillStyle = "white";
                ctx.fill(this.pinPath);
                ctx.restore();
            }
        }
        ctx.globalAlpha = 1;

        // 4. labels
        if (drawLabels) {
            ctx.textBaseline = "alphabetic";
            ctx.textAlign = "left";
            let currentFont = "";
            for (const n of this.nodes) {
                if (n.type !== "person" || !n.name || n.labelHidden || !this.drawnIds.has(n.id)) continue;
                const bold = n.id === this.hoveredId;
                const font = this.labelFont(bold);
                if (font !== currentFont) {
                    ctx.font = font;
                    currentFont = font;
                }
                ctx.globalAlpha = this.dropClasses.get(n.id) === "drop-disallowed" ? 0.3 : 1;
                ctx.fillStyle = this.highlightedIds.has(n.id) ? TEXT_COLOR : shadedNodeColor;
                ctx.fillText(n.name, n.x + (n.labelDx ?? LABEL_DX), n.y + (n.labelDy ?? LABEL_DY));
            }
            ctx.globalAlpha = 1;
        }

        // 5. ghosts
        this.ghostLayers = this.ghostLayers.filter((l) => l.dying == null || now - l.dying < GHOST_FADE_MS);
        for (const layer of this.ghostLayers) {
            const fade = layer.dying != null
                ? 1 - (now - layer.dying) / GHOST_FADE_MS
                : Math.min(1, (now - layer.born) / GHOST_FADE_MS);
            if (fade < 1) animating = true;
            this.drawGhostLayer(layer.set, Math.max(0, fade), drawLabels);
        }

        // 6. drag-gesture overlay
        this.drawOverlay();

        ctx.globalAlpha = 1;
        this.lastStats = { edges: edgeCount, arrows: arrowCount, nodes: this.drawnIds.size };
        if (!this.firstDrawAt && this.drawnIds.size > 0) this.firstDrawAt = performance.now();
        if (animating) this.requestRender();
    }

    private highlightedFamilyEnd(n: ChartNode): boolean {
        return n.type === "family" && this.highlightedIds.has(n.id);
    }

    private highlightedPersonEnd(n: ChartNode): boolean {
        return n.type === "person" && this.highlightedIds.has(n.id);
    }

    private segmentCrossesView(a: ChartNode, b: ChartNode, x0: number, y0: number, x1: number, y1: number): boolean {
        return !(Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1 || Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1);
    }

    /** Appends the arrow triangle for a line ending at (x2,y2) to the current path. */
    private addArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, refX: number): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len === 0) return false;
        const ux = dx / len;
        const uy = dy / len;
        // marker point (mx,my) → world: end + u*(mx-refX) + n*(my-3), n = (-uy, ux)
        const pt = (mx: number, my: number): [number, number] => [
            x2 + ux * (mx - refX) - uy * (my - 3),
            y2 + uy * (mx - refX) + ux * (my - 3),
        ];
        const [ax, ay] = pt(0, 0);
        const [bx, by] = pt(10, 3);
        const [cx, cy] = pt(0, 6);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy);
        ctx.closePath();
        return true;
    }

    private drawClanLabel(d: ClanRenderData) {
        const ctx = this.ctx;
        const text = clanLabelText(d.clan);
        const fontPx = d.labelFontSize;
        ctx.save();
        ctx.translate(d.shape.cx, d.shape.cy);
        ctx.rotate(d.shape.angle);
        ctx.globalAlpha = CLAN_LABEL_OPACITY;
        ctx.fillStyle = "#ffffff";
        ctx.font = `600 ${fontPx}px ${CLAN_LABEL_FONT_FAMILY}`;
        ctx.textBaseline = "middle";
        const spacing = CLAN_LABEL_LETTER_SPACING_EM * fontPx;
        const supportsLetterSpacing = "letterSpacing" in (ctx as object);
        if (supportsLetterSpacing) {
            (ctx as any).letterSpacing = `${spacing}px`;
            ctx.textAlign = "center";
            ctx.fillText(text, 0, 0);
            (ctx as any).letterSpacing = "0px";
        } else {
            // manual letter spacing
            const total = ctx.measureText(text).width + spacing * text.length;
            let x = -total / 2;
            ctx.textAlign = "left";
            for (const ch of text) {
                ctx.fillText(ch, x, 0);
                x += ctx.measureText(ch).width + spacing;
            }
        }
        ctx.restore();
    }

    private resolveGhostEndpoint(set: GhostSet, id: string): { x: number; y: number } | null {
        const ghost = set.nodes.find((n) => n.id === id);
        if (ghost) return ghost;
        return this.nodeById.get(id) ?? null;
    }

    private drawGhostLayer(set: GhostSet, fade: number, drawLabels: boolean) {
        const ctx = this.ctx;
        // edges
        for (const e of set.edges) {
            const s = this.resolveGhostEndpoint(set, e.sourceId);
            const tg = this.resolveGhostEndpoint(set, e.targetId);
            if (!s || !tg) continue;
            const sourceR = e.edgeKind === "focusToFamily" ? personR : familyR;
            const targetR = e.edgeKind === "focusToFamily" ? familyR : personR;
            const tip = trimToCircle(s.x, s.y, tg.x, tg.y, targetR + GHOST_EDGE_GAP);
            const tail = trimToCircle(tg.x, tg.y, s.x, s.y, sourceR + GHOST_EDGE_GAP);
            ctx.globalAlpha = 0.5 * fade;
            ctx.strokeStyle = GHOST_COLOR;
            ctx.lineWidth = e.edgeKind === "focusToFamily" ? px(familyRelationWidth) : px(childRelationWidth);
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(tail.x, tail.y);
            ctx.lineTo(tip.x, tip.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            this.addArrow(ctx, tail.x, tail.y, tip.x, tip.y, GHOST_ARROW_REF_X);
            ctx.fillStyle = GHOST_COLOR;
            ctx.fill();
        }
        // nodes
        for (const g of set.nodes) {
            const hovered = g.id === this.hoveredGhostId;
            if (g.type === "ghost-family") {
                ctx.globalAlpha = 0.5 * fade * 0.3;
                ctx.beginPath();
                ctx.arc(g.x, g.y, familyR, 0, Math.PI * 2);
                ctx.fillStyle = defaultFamilyColor;
                ctx.fill();
                ctx.globalAlpha = 0.5 * fade;
                ctx.setLineDash([5, 3]);
                ctx.strokeStyle = GHOST_COLOR;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.setLineDash([]);
                continue;
            }
            const groupAlpha = (hovered ? 1 : 0.6) * fade;
            ctx.beginPath();
            ctx.arc(g.x, g.y, personR, 0, Math.PI * 2);
            ctx.globalAlpha = groupAlpha * (hovered ? 0.85 : 0.25);
            ctx.fillStyle = g.color ?? GHOST_COLOR;
            ctx.fill();
            ctx.globalAlpha = groupAlpha;
            ctx.setLineDash([5, 3]);
            ctx.strokeStyle = GHOST_COLOR;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.setLineDash([]);
            if (drawLabels && g.label) {
                ctx.font = this.labelFont(false);
                ctx.textAlign = "left";
                ctx.textBaseline = "alphabetic";
                ctx.fillStyle = GHOST_COLOR;
                ctx.fillText(g.label, g.x + LABEL_DX, g.y + LABEL_DY);
            }
        }
        ctx.globalAlpha = 1;
    }

    private drawOverlay() {
        const ctx = this.ctx;
        const o = this.overlay;
        const dashedCircle = (x: number, y: number, r: number, alpha: number) => {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = "rgba(13, 110, 253, 0.08)";
            ctx.fill();
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = ACCENT;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.setLineDash([]);
        };
        if (o.line) {
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = ACCENT;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(o.line.x1, o.line.y1);
            ctx.lineTo(o.line.x2, o.line.y2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (o.sourceMarker) dashedCircle(o.sourceMarker.x, o.sourceMarker.y, 8, 0.7);
        if (o.preview) dashedCircle(o.preview.x, o.preview.y, o.preview.r, 0.75);
        ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------ export / debug

    /** Everything needed to rebuild the picture as a standalone SVG document. */
    exportModel() {
        return {
            nodes: this.nodes.map((n) => ({
                id: n.id,
                type: n.type,
                name: n.name ?? null,
                x: n.x,
                y: n.y,
                r: this.nodeRadius(n),
                fill: this.fillById.get(n.id) ?? shadedNodeColor,
                highlighted: this.highlightedIds.has(n.id),
                pinned: n.type === "person" && this.pinnedPersonIds.has(denormalizeId(n.id)),
                labelDx: n.labelDx ?? LABEL_DX,
                labelDy: n.labelDy ?? LABEL_DY,
                labelHidden: !!n.labelHidden,
                labelWidth: n.name ? this.labelWidth(n.name) : 0,
                bold: n.id === this.hoveredId,
            })),
            links: this.links
                .filter((l) => typeof l.source === "object" && typeof l.target === "object")
                .map((l) => {
                    const s = l.source as ChartNode;
                    const tt = l.target as ChartNode;
                    const on = (this.highlightedFamilyEnd(s) || this.highlightedFamilyEnd(tt)) &&
                        (this.highlightedPersonEnd(s) || this.highlightedPersonEnd(tt));
                    return {
                        x1: s.x,
                        y1: s.y,
                        x2: tt.x,
                        y2: tt.y,
                        type: l.type,
                        arrow: arrowKindFor(l.type),
                        stroke: on ? relationsColor : shadedRelationColor,
                        width: on ? (l.type === "familyToChild" ? childRelationWidth : familyRelationWidth) : shadedRelationWidth,
                    };
                }),
            clans: this.clanData.map((d) => ({
                color: d.clan.color,
                path: clanBlobPath(d.hull) as string,
                hull: d.hull,
                label: clanLabelText(d.clan),
                fontSize: d.labelFontSize,
                cx: d.shape.cx,
                cy: d.shape.cy,
                angle: d.shape.angle,
            })),
            pinPath: PIN_PATH,
            labelFontSize,
        };
    }

    /** Test/debug hook: what is on screen, in world and client coordinates. */
    snapshot() {
        const pendingId = (id: string) => id.includes("pending-");
        const nodes: ChartSnapshotNode[] = this.nodes.map((n) => {
            const c = this.worldToClient(n.x, n.y);
            return {
                id: n.id,
                type: n.type,
                name: n.name ?? null,
                x: n.x,
                y: n.y,
                r: this.nodeRadius(n),
                drawn: this.drawnIds.has(n.id),
                pending: pendingId(n.id),
                clientX: c.x,
                clientY: c.y,
            };
        });
        const ghosts = this.ghostLayers.flatMap((l) =>
            l.set.nodes.map((g) => {
                const c = this.worldToClient(g.x, g.y);
                return { id: g.id, type: g.type, x: g.x, y: g.y, label: g.label ?? null, clientX: c.x, clientY: c.y, dying: l.dying != null };
            }),
        );
        const edges = this.links
            .filter((l) => typeof l.source === "object" && typeof l.target === "object")
            .map((l) => ({
                id: l.id,
                type: l.type,
                source: (l.source as ChartNode).id,
                target: (l.target as ChartNode).id,
                arrow: arrowKindFor(l.type),
            }));
        return {
            nodes,
            ghosts,
            edges,
            stats: { ...this.lastStats },
            transform: { x: this.transform.x, y: this.transform.y, k: this.transform.k },
        };
    }
}
