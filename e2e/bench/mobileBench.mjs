// Phone-like rendering benchmark: 390×844 CSS px, DPR 3, touch, CPU throttled.
//   (build + serve as in renderBench.mjs)
//   node bench/mobileBench.mjs <people|stemma.json> [cpuSlowdown=4] [dpr=3]
// Reports fps and main-thread busy % while the layout settles and while a
// finger pans the chart, plus the top self-time functions during the pan.
import { chromium } from "@playwright/test";
import { loadStemma, mockBackend } from "./stemmaSource.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const spec = process.argv[2] ?? "1000";
const slowdown = Number(process.argv[3] ?? 4);
const dpr = Number(process.argv[4] ?? 3);
const stemma = loadStemma(spec);
const r1 = (x) => Math.round(x * 10) / 10;
globalThis.r1 = r1;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
await mockBackend(context, () => stemma);
await context.addInitScript(() => {
  window.__frames = [];
  const tick = (t) => {
    window.__frames.push(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
await cdp.send("Emulation.setCPUThrottlingRate", { rate: slowdown });

const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
async function window_(label, ms, during) {
  await page.evaluate(() => window.__stemmaChart.renderTiming?.(true));
  const a = await metrics();
  const f0 = await page.evaluate(() => window.__frames.length);
  const t0 = Date.now();
  await (during ? during() : page.waitForTimeout(ms));
  const sec = (Date.now() - t0) / 1000;
  const b = await metrics();
  const gaps = await page.evaluate((f0) => {
    const f = window.__frames.slice(Math.max(0, f0 - 1));
    const g = [];
    for (let i = 1; i < f.length; i++) g.push(f[i] - f[i - 1]);
    return g;
  }, f0);
  gaps.sort((x, y) => x - y);
  const p = (q) => r1(gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * q))] ?? NaN);
  const rt = await page.evaluate(() => window.__stemmaChart.renderTiming?.(true) ?? {});
  console.log(label, JSON.stringify({
    fps: r1(gaps.length / sec), frameP50: p(0.5), frameP95: p(0.95), busyPct: r1(((b.TaskDuration - a.TaskDuration) / sec) * 100),
    fullDraws: rt.frames, drawAvgMs: rt.frames ? r1(rt.totalMs / rt.frames) : 0, drawMaxMs: r1(rt.maxMs ?? 0),
    renderMsPerSec: r1((rt.totalMs ?? 0) / sec),
  }));
}

const t0 = Date.now();
await page.goto(BASE);
await page.waitForFunction(() => window.__stemmaChart?.snapshot().nodes.length > 0, null, { timeout: 120_000 });
console.log("people", stemma.people.length, "firstDrawSec", r1((Date.now() - t0) / 1000));
await window_("settling(4s)", 4000);
await page.waitForFunction(() => { const l = window.__stemmaChart.layout(); return l.ends > 0 && l.lastEndAt >= l.lastTickAt; }, null, { timeout: 180_000 });
await page.waitForTimeout(1000);
await window_("idle(2s)", 2000);

// a spot with no node under it, so the finger pans instead of dragging someone
async function emptySpot() {
  return page.evaluate(() => {
    const nodes = window.__stemmaChart.snapshot().nodes;
    let best = { x: 195, y: 420, d: -1 };
    for (let y = 200; y <= 640; y += 20) for (let x = 60; x <= 330; x += 15) {
      let d = Infinity;
      for (const n of nodes) d = Math.min(d, Math.hypot(n.clientX - x, n.clientY - y));
      if (d > best.d) best = { x, y, d };
    }
    return best;
  });
}
// a finger panning back and forth for ~3 s
async function pan() {
  const { x: cx, y: cy } = await emptySpot();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 90; i++) {
    const dx = Math.sin(i / 10) * 120;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + dx, y: cy + dx / 2 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
// pinch zoom in and out
async function pinch() {
  const { x: cx, y: cy } = await emptySpot();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx - 40, y: cy, id: 1 }, { x: cx + 40, y: cy, id: 2 }] });
  for (let i = 1; i <= 90; i++) {
    const d = 40 + Math.sin(i / 14) * 100 + 60;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
// a finger dragging a person around (view mode: the layout follows live)
async function dragNode() {
  const target = await page.evaluate(() => {
    const ns = window.__stemmaChart.snapshot().nodes.filter((n) => n.type === "person" && n.clientX > 80 && n.clientX < 310 && n.clientY > 250 && n.clientY < 600);
    return ns[Math.floor(ns.length / 2)];
  });
  // how often the rest of the graph moves on screen, frame by frame
  await page.evaluate((id) => {
    window.__moves = [];
    let last = null;
    const watch = () => {
      if (!window.__watching) return;
      const nodes = window.__stemmaChart.snapshot().nodes;
      const sig = nodes.filter((n) => n.id !== id).slice(0, 40).map((n) => n.x.toFixed(1)).join(",");
      window.__moves.push(sig !== last);
      last = sig;
      requestAnimationFrame(watch);
    };
    window.__watching = true;
    requestAnimationFrame(watch);
  }, target.id);
  const cx = target.clientX, cy = target.clientY;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
  for (let i = 1; i <= 150; i++) {
    const a = i / 12;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + Math.sin(a) * 90, y: cy + (1 - Math.cos(a)) * 60 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const moves = await page.evaluate(() => {
    window.__watching = false;
    const m = window.__moves.slice(5);
    return { frames: m.length, framesWithLayoutMove: m.filter(Boolean).length };
  });
  console.log("dragNode layout updates", JSON.stringify({ ...moves, sharePct: r1((moves.framesWithLayoutMove / moves.frames) * 100) }));
}
await window_("dragNode", 0, dragNode);
await page.waitForTimeout(3000);
await window_("pan", 0, pan);
await window_("pinch", 0, pinch);

await cdp.send("Profiler.enable");
await cdp.send("Profiler.start");
await pan();
await pinch();
const { profile } = await cdp.send("Profiler.stop");
const self = new Map();
const byId = new Map(profile.nodes.map((x) => [x.id, x]));
const counts = new Map();
for (const s of profile.samples) counts.set(s, (counts.get(s) ?? 0) + 1);
for (const [id, c] of counts) {
  const n = byId.get(id);
  const key = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`;
  self.set(key, (self.get(key) ?? 0) + c);
}
const total = profile.samples.length;
console.log("top self time during pan+pinch:");
for (const [k, c] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(" ", r1((c / total) * 100) + "%", k);
await browser.close();
