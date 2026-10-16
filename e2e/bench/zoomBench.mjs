// Large-graph benchmark: load, settle, then pan at full zoom-out and mid zoom.
//   node bench/zoomBench.mjs <people|stemma.json> [screenshotPrefix]
// Reports first draw / settle times, fps + render() CPU while panning, and
// layout quality (person overlaps, edge crossings, spread).
import { chromium } from "@playwright/test";
import { loadStemma, mockBackend } from "./stemmaSource.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const spec = process.argv[2] ?? "1000";
const shots = process.argv[3] ?? null;
const SETTLE_TIMEOUT_MS = Number(process.env.SETTLE_TIMEOUT_MS ?? 180_000);
const stemma = loadStemma(spec);
const r1 = (x) => Math.round(x * 10) / 10;

function quality(snap) {
  const pos = new Map(snap.nodes.map((n) => [n.id, n]));
  const people = snap.nodes.filter((n) => n.type === "person");
  // overlaps: person centres closer than 40 (grid)
  const cell = 40;
  const grid = new Map();
  for (const p of people) {
    const k = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)).push(p);
  }
  let overlaps = 0;
  for (const p of people) {
    const gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const q of grid.get(`${gx + dx}:${gy + dy}`) ?? []) if (q.id > p.id && Math.hypot(p.x - q.x, p.y - q.y) < 40) overlaps++;
    }
  }
  // crossings: proper intersections of edges not sharing an endpoint (grid-bucketed)
  const segs = snap.edges.map((e) => {
    const a = pos.get(e.source), b = pos.get(e.target);
    return { s: e.source, t: e.target, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  const lens = segs.map((g) => Math.hypot(g.x2 - g.x1, g.y2 - g.y1)).sort((a, b) => a - b);
  const bucket = Math.max(200, lens[Math.floor(lens.length * 0.9)] || 200);
  const sg = new Map();
  const longSegs = [];
  segs.forEach((g, i) => {
    const x0 = Math.floor(Math.min(g.x1, g.x2) / bucket), x1 = Math.floor(Math.max(g.x1, g.x2) / bucket);
    const y0 = Math.floor(Math.min(g.y1, g.y2) / bucket), y1 = Math.floor(Math.max(g.y1, g.y2) / bucket);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) { longSegs.push(i); return; } // long edge: checked against all edges below // absurdly long edge: skip bucketing cost
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = `${x}:${y}`;
      (sg.get(k) ?? sg.set(k, []).get(k)).push(i);
    }
  });
  const orient = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  const seen = new Set();
  let crossings = 0;
  for (const ids of sg.values()) {
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const i = Math.min(ids[a], ids[b]), j = Math.max(ids[a], ids[b]);
      const key = i * 1e6 + j;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = segs[i], q = segs[j];
      if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) continue;
      const o1 = orient(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1), o2 = orient(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2);
      const o3 = orient(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1), o4 = orient(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2);
      if (o1 * o2 < 0 && o3 * o4 < 0) crossings++;
    }
  }
  const longSet = new Set(longSegs);
  for (const i of longSegs) for (let j = 0; j < segs.length; j++) {
    if (j === i || (longSet.has(j) && j < i)) continue;
    const p = segs[i], q = segs[j];
    if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) continue;
    if (orient(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1) * orient(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2) < 0 && orient(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1) * orient(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2) < 0) crossings++;
  }
  const xs = snap.nodes.map((n) => n.x), ys = snap.nodes.map((n) => n.y);
  return {
    personOverlaps: overlaps,
    edgeCrossings: crossings,
    medianLink: Math.round(lens[lens.length >> 1]),
    p95Link: Math.round(lens[Math.floor(lens.length * 0.95)]),
    width: Math.round(Math.max(...xs) - Math.min(...xs)),
    height: Math.round(Math.max(...ys) - Math.min(...ys)),
  };
}

async function panTest(page, base, ms) {
  return await page.evaluate(async ({ base, ms }) => {
    const api = window.__stemmaChart;
    api.renderTiming(true);
    const frames = [];
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = (t) => {
        frames.push(t);
        const p = (t - t0) / 1000;
        api.setTransform(base.x + Math.sin(p * 2) * 150, base.y + Math.cos(p * 1.3) * 80, base.k);
        if (t - t0 < ms) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    const gaps = [];
    for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1]);
    gaps.sort((a, b) => a - b);
    const r = api.renderTiming(true);
    return {
      fps: Math.round((frames.length / ms) * 10000) / 10,
      p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10,
      renderAvgMs: Math.round((r.totalMs / Math.max(1, r.frames)) * 10) / 10,
      renderMaxMs: Math.round(r.maxMs * 10) / 10,
    };
  }, { base, ms });
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
await mockBackend(context, () => stemma);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message));
const out = { people: stemma.people.length, families: stemma.families.length };
const t0 = Date.now();
await page.goto(BASE);
await page.waitForFunction(() => window.__stemmaChart?.layout?.().firstDrawAt > 0, null, { timeout: 120_000 });
out.firstDrawMs = Math.round(await page.evaluate(() => window.__stemmaChart.layout().firstDrawAt));
let l;
while (Date.now() - t0 < SETTLE_TIMEOUT_MS) {
  l = await page.evaluate(() => ({ ...window.__stemmaChart.layout(), now: performance.now() }));
  if (l.ends > 0 && !l.running && l.now - l.lastEndAt > 300) break;
  await page.waitForTimeout(200);
}
out.settleMs = l.ends > 0 && !l.running ? Math.round(l.lastEndAt) : null;
out.quality = quality(await page.evaluate(() => window.__stemmaChart.snapshot()));

const fit = await page.evaluate(() => window.__stemmaChart.fit());
await page.waitForTimeout(500);
if (shots) await page.screenshot({ path: `${shots}-fit.png` });
out.zoomedOut = { k: Math.round(fit.k * 1000) / 1000, ...(await panTest(page, fit, 3000)) };
const mid = { x: 720 - (720 - fit.x) * 6, y: 450 - (450 - fit.y) * 6, k: fit.k * 6 };
await page.evaluate((m) => window.__stemmaChart.setTransform(m.x, m.y, m.k), mid);
await page.waitForTimeout(300);
if (shots) await page.screenshot({ path: `${shots}-mid.png` });
out.midZoom = { k: Math.round(mid.k * 1000) / 1000, ...(await panTest(page, mid, 3000)) };
console.log(JSON.stringify(out));
await browser.close();
