// Starting-layout experiments: seed variants, each followed by the force
// refine, on a synthetic size or a Stemma JSON path (read at runtime only).
// Bundles the real frontend modules (structuredLayout, layoutCore, clans…).
//   node bench/seedExperiment.mjs <people|stemma.json> [variant,variant] [pngPrefix]
// Reports surname-cloud overlap (share of cloud area covered by ≥2 clouds),
// edge crossings, person overlaps, link lengths and overall size.
import { rollup } from "../../frontend/node_modules/rollup/dist/es/rollup.js";
import typescript from "../../frontend/node_modules/@rollup/plugin-typescript/dist/es/index.js";
import resolve from "../../frontend/node_modules/@rollup/plugin-node-resolve/dist/es/index.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadStemma } from "./stemmaSource.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolvePath(here, "../../frontend");
const tmp = mkdtempSync(join(tmpdir(), "seed-exp-"));
const entry = join(tmp, "entry.ts");
const src = (f) => JSON.stringify(join(frontend, "src", f));
writeFileSync(entry, `export { structuredLayout } from ${src("structuredLayout.ts")};
export { createLayoutSimulation, setCrossRegionLinkStrength, anchorAtRest, anchorWhereMissing, giveCollisionRadius, LAYOUT_REFINE_ALPHA, LAYOUT_REHEAT_ALPHA } from ${src("layoutCore.ts")};
export { computeInitialLayout, seedFromKnown, strandedKnown } from ${src("initialLayout.ts")};
export { StemmaIndex } from ${src("stemmaIndex.ts")};
export { makeNodesAndRelations } from ${src("graphTools.js")};
export { computeClans } from ${src("clans.ts")};
export { clanShape, paddedHull } from ${src("clanLayer.ts")};
`);
const bundle = await rollup({
  input: entry,
  plugins: [resolve({ rootDir: frontend, modulePaths: [join(frontend, "node_modules")] }), typescript({ tsconfig: join(frontend, "tsconfig.json"), include: [join(frontend, "src/**/*"), entry], noEmitOnError: false, compilerOptions: { verbatimModuleSyntax: false } })],
  onwarn: () => {},
});
const out = join(tmp, "bundle.mjs");
await bundle.write({ file: out, format: "es" });
const lib = await import(out);

let stemma = loadStemma(process.argv[2] ?? "1000");
const only = process.argv[3] ? process.argv[3].split(",") : null;
const pngPrefix = process.argv[4] ?? null;
const W = 1440, H = 900;
const clans = lib.computeClans(stemma);
if (process.env.CROSS) lib.setCrossRegionLinkStrength(Number(process.env.CROSS));

function graph() {
  const [nodes, links] = lib.makeNodesAndRelations(stemma.people, stemma.families);
  return { nodes, links };
}

/**
 * Reopening an edited stemma (WARM_FROM=<older.json>[,<newer.json>…]): the
 * oldest version is laid out like a fresh open (star seed, free refine,
 * anchored at rest); every later one, and finally this stemma, is reopened
 * from the previous layout as FullStemma does: newcomers seeded next to their
 * relatives (or parked aside when they have none), anchored where seeded, and
 * the whole graph refined from the warm-start alpha. Remembered nodes stranded
 * away from their relatives are re-seeded as in the app (KEEP_STRANDED=1: not).
 */
function warmStart() {
  const versions = process.env.WARM_FROM.split(",");
  const target = stemma;
  stemma = loadStemma(versions[0]);
  const first = seedStructured({ mode: "star" }, false);
  lib.giveCollisionRadius(first.nodes);
  refine(first.nodes, first.links, 1, false);
  lib.anchorAtRest(first.nodes, W, H);
  let prev = first.nodes;
  let last;
  for (const v of [...versions.slice(1), null]) {
    stemma = v ? loadStemma(v) : target;
    last = reopen(prev);
    if (v) refine(last.g.nodes, last.g.links, last.alpha, false);
    prev = last.g.nodes;
  }
  return last;
}

function reopen(prevNodes) {
  const known = new Map(prevNodes.map((n) => [n.id, n]));
  const g = graph();
  if (!process.env.KEEP_STRANDED) for (const id of lib.strandedKnown(g.nodes.map((n) => n.id), g.links, new Set(g.nodes.filter((n) => known.has(n.id)).map((n) => n.id)))) known.delete(id);
  for (const n of g.nodes) {
    const k = known.get(n.id);
    if (k) Object.assign(n, { x: k.x, y: k.y, ax: k.ax, ay: k.ay });
  }
  const t0 = performance.now();
  const index = new lib.StemmaIndex({ type: "Stemma", people: stemma.people, families: stemma.families });
  const fallback = lib.computeInitialLayout(index, stemma.people, stemma.families, W, H);
  const seeds = lib.seedFromKnown(g.nodes, g.links, new Map([...known].map(([id, k]) => [id, [k.x, k.y]])), fallback);
  for (const n of g.nodes) if (!known.has(n.id)) [n.x, n.y] = seeds.get(n.id);
  lib.giveCollisionRadius(g.nodes);
  lib.anchorWhereMissing(g.nodes);
  const knownFrac = g.nodes.filter((n) => known.has(n.id)).length / g.nodes.length;
  return { g: { ...g, seedMs: Math.round(performance.now() - t0) }, alpha: Math.min(lib.LAYOUT_REHEAT_ALPHA, lib.LAYOUT_REFINE_ALPHA + (1 - knownFrac)), anchored: false };
}

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Share of the clouds' area that is covered by two or more clouds (grid sampled). */
function cloudOverlap(nodes) {
  const pos = new Map(nodes.map((n) => [n.id, [n.x, n.y]]));
  const polys = [];
  for (const c of clans) {
    const pts = [...c.personIds].map((id) => pos.get("person_" + id)).filter(Boolean);
    if (pts.length < 2) continue;
    const hull = lib.paddedHull(pts, lib.clanShape(pts));
    const xs = hull.map((p) => p[0]), ys = hull.map((p) => p[1]);
    polys.push({ hull, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  }
  if (!polys.length) return { clouds: 0, overlapShare: 0 };
  const X0 = Math.min(...polys.map((p) => p.x0)), X1 = Math.max(...polys.map((p) => p.x1));
  const Y0 = Math.min(...polys.map((p) => p.y0)), Y1 = Math.max(...polys.map((p) => p.y1));
  const N = 500;
  const sx = (X1 - X0) / N, sy = (Y1 - Y0) / N;
  let covered = 0, multi = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = X0 + (i + 0.5) * sx, y = Y0 + (j + 0.5) * sy;
    let k = 0;
    for (const p of polys) {
      if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) continue;
      if (inPoly(x, y, p.hull) && ++k >= 2) break;
    }
    if (k >= 1) covered++;
    if (k >= 2) multi++;
  }
  return { clouds: polys.length, overlapShare: Math.round((multi / covered) * 1000) / 1000 };
}

// clan region of every node, for the crossing breakdown (same for every variant)
let regionById = new Map();
// non-tree edges of the last star seed (for the crossing breakdown)
let nonTree = new Set();
function quality(nodes, links) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const people = nodes.filter((n) => n.type === "person");
  const cell = 40, grid = new Map();
  for (const p of people) { const k = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(p); }
  let overlaps = 0;
  for (const p of people) {
    const gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of grid.get(`${gx + dx}:${gy + dy}`) ?? []) if (q.id > p.id && Math.hypot(p.x - q.x, p.y - q.y) < 40) overlaps++;
  }
  const segs = links.map((l) => { const a = byId.get(typeof l.source === "string" ? l.source : l.source.id), b = byId.get(typeof l.target === "string" ? l.target : l.target.id); return { s: a.id, t: b.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y, inter: regionById.get(a.id) !== regionById.get(b.id), extra: nonTree.has(`${a.id}|${b.id}`) }; });
  const lens = segs.map((g) => Math.hypot(g.x2 - g.x1, g.y2 - g.y1)).sort((a, b) => a - b);
  const bucket = Math.max(200, lens[Math.floor(lens.length * 0.9)] || 200);
  const sg = new Map();
  const longSegs = [];
  segs.forEach((g, i) => {
    const x0 = Math.floor(Math.min(g.x1, g.x2) / bucket), x1 = Math.floor(Math.max(g.x1, g.x2) / bucket);
    const y0 = Math.floor(Math.min(g.y1, g.y2) / bucket), y1 = Math.floor(Math.max(g.y1, g.y2) / bucket);
    g.cx0 = x0; g.cy0 = y0;
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) { longSegs.push(i); return; } // long edge: checked against all edges below
    for (let xx = x0; xx <= x1; xx++) for (let yy = y0; yy <= y1; yy++) { const k = `${xx}:${yy}`; (sg.get(k) ?? sg.set(k, Object.assign([], { cx: xx, cy: yy })).get(k)).push(i); }
  });
  const orient = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  let crossings = 0; let interCrossings = 0; let nonTreeCrossings = 0;
  for (const ids of sg.values()) for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const i = Math.min(ids[a], ids[b]), j = Math.max(ids[a], ids[b]);
    const p = segs[i], q = segs[j];
    if (Math.max(p.cx0, q.cx0) !== ids.cx || Math.max(p.cy0, q.cy0) !== ids.cy) continue; // count each pair once: in its first shared cell
    if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) continue;
    if (orient(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1) * orient(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2) < 0 && orient(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1) * orient(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2) < 0) { crossings++; if (p.inter || q.inter) interCrossings++; if (p.extra || q.extra) nonTreeCrossings++; }
  }
  const longSet = new Set(longSegs);
  for (const i of longSegs) for (let j = 0; j < segs.length; j++) {
    if (j === i || (longSet.has(j) && j < i)) continue;
    const p = segs[i], q = segs[j];
    if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) continue;
    if (orient(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1) * orient(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2) < 0 && orient(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1) * orient(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2) < 0) { crossings++; if (p.inter || q.inter) interCrossings++; if (p.extra || q.extra) nonTreeCrossings++; }
  }
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const interLens = segs.filter((g) => g.inter).map((g) => Math.hypot(g.x2 - g.x1, g.y2 - g.y1)).sort((a, b) => a - b);
  return { ...cloudOverlap(nodes), medianInterLink: Math.round(interLens[interLens.length >> 1] ?? 0), maxInterLink: Math.round(interLens[interLens.length - 1] ?? 0), crossings, nonTreeEdges: segs.filter((g) => g.extra).length, nonTreeCrossings, interCrossings, interEdges: segs.filter((g) => g.inter).length, overlaps, medianLink: Math.round(lens[lens.length >> 1]), p95Link: Math.round(lens[Math.floor(lens.length * 0.95)]), w: Math.round(Math.max(...xs) - Math.min(...xs)), h: Math.round(Math.max(...ys) - Math.min(...ys)) };
}

function refine(nodes, links, alpha, anchored) {
  if (anchored) for (const n of nodes) { n.ax = n.x; n.ay = n.y; }
  // COLLIDE=1: every real node collides (person 20, family 10 units)
  if (process.env.COLLIDE) for (const n of nodes) n.r = n.type === "person" ? 1 : 0.5;
  const sim = lib.createLayoutSimulation(nodes, links, W, H);
  sim.alpha(alpha);
  const t0 = performance.now();
  let ticks = 0;
  while (sim.alpha() >= sim.alphaMin()) { sim.tick(); ticks++; }
  return { ticks, ms: Math.round(performance.now() - t0) };
}

function seedStructured(options, withRegions = true) {
  const g = graph();
  const idx = new Map(g.nodes.map((n, i) => [n.id, i]));
  const pairs = [];
  for (const l of g.links) pairs.push(idx.get(l.source), idx.get(l.target));
  const t0 = performance.now();
  const groups = new Int32Array(g.nodes.length).fill(-1);
  const clanSize = clans.map((c) => c.personIds.size);
  clans.forEach((c, ci) => {
    for (const pid of c.personIds) {
      const i = idx.get("person_" + pid);
      if (i == null) continue;
      if (groups[i] < 0 || clanSize[ci] > clanSize[groups[i]]) groups[i] = ci;
    }
  });
  const { x, y, region, nonTreeEdges } = lib.structuredLayout({ ids: g.nodes.map((n) => n.id), links: Int32Array.from(pairs), center: [W / 2, H / 2], groups }, options);
  if (withRegions) g.nodes.forEach((n, i) => (n.region = region[i]));
  const ms = Math.round(performance.now() - t0);
  g.nodes.forEach((n, i) => { n.x = x[i]; n.y = y[i]; });
  nonTree = new Set();
  for (let i = 0; i < nonTreeEdges.length; i += 2) nonTree.add(`${g.nodes[nonTreeEdges[i]].id}|${g.nodes[nonTreeEdges[i + 1]].id}`).add(`${g.nodes[nonTreeEdges[i + 1]].id}|${g.nodes[nonTreeEdges[i]].id}`);
  return { ...g, seedMs: ms };
}

async function savePng(nodes, links, file) {
  const { chromium } = await import("@playwright/test");
  const pos = new Map(nodes.map((n) => [n.id, n]));
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const S = 1000, pad = 10, k = (S - 2 * pad) / Math.max(maxX - minX, maxY - minY);
  const tx = (v) => pad + (v - minX) * k, ty = (v) => pad + (v - minY) * k;
  let svg = "";
  for (const c of clans) {
    const pts = [...c.personIds].map((id) => pos.get("person_" + id)).filter(Boolean).map((n) => [n.x, n.y]);
    if (pts.length < 2) continue;
    const hull = lib.paddedHull(pts, lib.clanShape(pts));
    svg += `<polygon points="${hull.map((p) => `${tx(p[0])},${ty(p[1])}`).join(" ")}" fill="${c.color}" fill-opacity="0.35"/>`;
  }
  for (const l of links) {
    const a = pos.get(typeof l.source === "string" ? l.source : l.source.id), b = pos.get(typeof l.target === "string" ? l.target : l.target.id);
    svg += `<line x1="${tx(a.x)}" y1="${ty(a.y)}" x2="${tx(b.x)}" y2="${ty(b.y)}" stroke="#777" stroke-width="0.4"/>`;
  }
  for (const n of nodes) if (n.type === "person") svg += `<circle cx="${tx(n.x)}" cy="${ty(n.y)}" r="0.9" fill="#2b1d7a"/>`;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: S, height: S } });
  await page.setContent(`<body style="margin:0;background:#fff"><svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${svg}</svg></body>`);
  await page.screenshot({ path: file });
  await browser.close();
}

const VARIANTS = {
  // before 47e12c0: one row per generation + global centring forces
  rows: () => {
    const g = graph();
    const index = new lib.StemmaIndex({ type: "Stemma", people: stemma.people, families: stemma.families });
    const t0 = performance.now();
    const init = lib.computeInitialLayout(index, stemma.people, stemma.families, W, H);
    for (const n of g.nodes) [n.x, n.y] = init.get(n.id) ?? [W / 2, H / 2];
    return { g: { ...g, seedMs: Math.round(performance.now() - t0) }, alpha: 1, anchored: false };
  },
  // 47e12c0: generation rings + global centring forces
  rings: () => ({ g: seedStructured({ mode: "rings" }, false), alpha: 1, anchored: false }),
  // clan regions (current default) + anchored refine with weak cross-region links
  clans: () => ({ g: seedStructured({ mode: "clans" }), alpha: 1, anchored: true }),
  clansSeedOnly: () => ({ g: seedStructured({ mode: "clans" }), alpha: 0, anchored: true }),
  clansRotated: () => ({ g: seedStructured({ mode: "clans", islandRotation: true }), alpha: 1, anchored: true }),
  clansRotatedGaps: () => ({ g: seedStructured({ mode: "clans", islandRotation: true, regionGapMin: 150 }), alpha: 1, anchored: true }),
  clansGaps: () => ({ g: seedStructured({ mode: "clans", regionGapMin: 150 }), alpha: 1, anchored: true }),
  layered: () => ({ g: seedStructured({ mode: "layered" }, false), alpha: 0, anchored: false }),
  layeredRefined: () => ({ g: seedStructured({ mode: "layered" }, false), alpha: 1, anchored: true }),
  star: () => ({ g: seedStructured({ mode: "star" }, false), alpha: 0, anchored: true }),
  starSparseClans: () => ({ g: seedStructured({ mode: "star", starOrderPasses: 6, starSpacing: 80 }), alpha: 1, anchored: true }),
  starClans: () => ({ g: seedStructured({ mode: "star", starOrderPasses: 6 }), alpha: 1, anchored: true }),
  starOrderedLight: () => ({ g: seedStructured({ mode: "star", starOrderPasses: 6 }, false), alpha: 0.05, anchored: true }),
  starSparse: () => ({ g: seedStructured({ mode: "star", starOrderPasses: 6, starSpacing: 80 }, false), alpha: 0, anchored: true }),
  starSparseLight: () => ({ g: seedStructured({ mode: "star", starOrderPasses: 6, starSpacing: 80 }, false), alpha: 0.05, anchored: true }),
  starSparseRefined: () => ({ g: seedStructured({ mode: "star", starOrderPasses: 6, starSpacing: 80 }, false), alpha: 1, anchored: true }),
  starGap300: () => ({ g: seedStructured({ mode: "star", starLevelGap: 300 }, false), alpha: 0, anchored: true }),
  starGap1000: () => ({ g: seedStructured({ mode: "star", starLevelGap: 1000 }, false), alpha: 0, anchored: true }),
  starOrdered: () => ({ g: seedStructured({ mode: "star", starOrderPasses: 6 }, false), alpha: 0, anchored: true }),
  starLight: () => ({ g: seedStructured({ mode: "star" }, false), alpha: 0.05, anchored: true }),
  starRefined: () => ({ g: seedStructured({ mode: "star" }, false), alpha: 1, anchored: true }),
  starFree: () => ({ g: seedStructured({ mode: "star" }, false), alpha: 1, anchored: false }),
  warm: () => warmStart(),
  clansPacked: () => ({ g: seedStructured({ mode: "clans", regionStart: "pack" }), alpha: 1, anchored: true }),
};

console.log(`people=${stemma.people.length} families=${stemma.families.length} clans=${clans.length}`);
{
  const g = seedStructured({ mode: "clans" });
  regionById = new Map(g.nodes.map((n) => [n.id, n.region]));
}
for (const [name, make] of Object.entries(VARIANTS)) {
  if (only && !only.includes(name)) continue;
  const { g, alpha, anchored } = make();
  const r = alpha > 0 ? refine(g.nodes, g.links, alpha, anchored) : { ticks: 0, ms: 0 };
  console.log(name.padEnd(16), `seed ${String(g.seedMs).padStart(5)} ms  refine ${String(r.ticks).padStart(3)} ticks ${String(r.ms).padStart(6)} ms `, JSON.stringify(quality(g.nodes, g.links)));
  if (pngPrefix) await savePng(g.nodes, g.links, `${pngPrefix}-${name}.png`);
}
