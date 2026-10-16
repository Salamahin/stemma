// Rendering benchmark for the family graph.
//
//   cd frontend && E2E_AUTO_LOGIN=1 GOOGLE_CLIENT_ID=bench STEMMA_BACKEND_URL=http://bench.invalid npm run build
//   npx sirv public --port 4180 --single &          (from frontend/)
//   cd e2e && node bench/renderBench.mjs 300 1000
//
// The backend is mocked with page.route, so no Docker/DynamoDB is needed.
// Uses the locally installed Chrome (channel "chrome").
import { chromium } from "@playwright/test";
import { syntheticStemma } from "./syntheticStemma.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const sizes = process.argv.slice(2).map(Number).filter(Boolean);
if (!sizes.length) sizes.push(300, 1000);

// Works against both renderers: the canvas exposes window.__stemmaChart,
// the legacy SVG had one <g id="person_..."> per person.
const PERSON_COUNT_SRC = `() => {
  const api = window.__stemmaChart;
  if (api) return api.snapshot().nodes.filter((n) => n.type === "person").length;
  return document.querySelectorAll("#chart g[id^='person_']").length;
}`;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const r1 = (x) => Math.round(x * 10) / 10;

async function metrics(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]));
}

async function busyWindow(page, cdp, ms) {
  const a = await metrics(cdp);
  const f0 = await page.evaluate(() => window.__frames.length);
  await page.waitForTimeout(ms);
  const b = await metrics(cdp);
  const frames = await page.evaluate((f0) => {
    const fs = window.__frames.slice(f0);
    let maxGap = 0;
    for (let i = 1; i < fs.length; i++) maxGap = Math.max(maxGap, fs[i] - fs[i - 1]);
    return { count: fs.length, maxGap };
  }, f0);
  const sec = ms / 1000;
  return {
    busyPct: r1(((b.TaskDuration - a.TaskDuration) / sec) * 100),
    scriptMsPerSec: r1(((b.ScriptDuration - a.ScriptDuration) * 1000) / sec),
    layoutStyleMsPerSec: r1((((b.LayoutDuration - a.LayoutDuration) + (b.RecalcStyleDuration - a.RecalcStyleDuration)) * 1000) / sec),
    fps: r1(frames.count / sec),
    maxFrameGapMs: r1(frames.maxGap),
  };
}

async function runOne(browser, n) {
  const stemma = syntheticStemma(n);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route("https://accounts.google.com/**", (r) => r.fulfill({ status: 200, body: "", contentType: "text/javascript" }));
  await context.route("http://bench.invalid/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const body = JSON.parse(req.postData() || "{}");
    let resp;
    if (body.type === "AuthLoginRequest") resp = { type: "AuthLoginResponse", userId: "u", email: "bench@local" };
    else if (body.type === "ListDescribeStemmasRequest")
      resp = {
        type: "OwnedStemmas",
        stemmas: [{ type: "StemmaDescription", id: "bench", name: "bench", removable: true }],
        firstStemma: stemma,
        favouriteStemmaId: null,
      };
    else if (body.type === "GetStemmaRequest") resp = stemma;
    else resp = { type: "UnknownError", cause: "bench" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp) });
  });
  await context.addInitScript(() => {
    window.__frames = [];
    const loop = (t) => {
      window.__frames.push(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  const out = { people: stemma.people.length, families: stemma.families.length };

  // ---- cold load (empty layout cache) ----
  const t0 = Date.now();
  await page.goto(BASE);
  await page.waitForFunction(`(${PERSON_COUNT_SRC})() === ${stemma.people.length}`, null, { timeout: 120000 });
  // first painted frame after nodes exist
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  out.coldFirstRenderMs = Date.now() - t0;
  out.settle0to5s = await busyWindow(page, cdp, 5000);
  await page.waitForTimeout(5000);
  out.steady10to15s = await busyWindow(page, cdp, 5000);

  // ---- hover (view mode highlights lineage) ----
  const hover = await page.evaluate(async () => {
    const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const api = window.__stemmaChart;
    const canvas = document.querySelector("canvas#chart");
    // Targets: 15 people spread across the list; hover = enter + leave.
    const targets = api
      ? api.snapshot().nodes.filter((n) => n.type === "person" && n.drawn)
      : [...document.querySelectorAll("#chart g[id^='person_']")];
    const pick = [];
    for (let i = 0; i < 15; i++) pick.push(targets[Math.floor((i * targets.length) / 15)]);
    const sync = [];
    const frame = [];
    for (const g of pick) {
      for (const type of ["mouseenter", "mouseleave"]) {
        const a = performance.now();
        if (api) {
          const at = type === "mouseenter" ? { clientX: g.clientX, clientY: g.clientY } : { clientX: 2, clientY: 2 };
          canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, ...at }));
        } else {
          g.dispatchEvent(new MouseEvent(type, { bubbles: false }));
        }
        const b = performance.now();
        await raf2();
        const c = performance.now();
        sync.push(b - a);
        frame.push(c - a);
      }
    }
    return { sync, frame };
  });
  out.hoverSyncMedianMs = r1(median(hover.sync));
  out.hoverToPaintMedianMs = r1(median(hover.frame));
  out.afterHover0to3s = await busyWindow(page, cdp, 3000);

  // ---- warm reload (layout cache populated) ----
  await page.waitForTimeout(1000);
  const t1 = Date.now();
  await page.reload();
  await page.waitForFunction(`(${PERSON_COUNT_SRC})() === ${stemma.people.length}`, null, { timeout: 120000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  out.warmFirstRenderMs = Date.now() - t1;
  out.warm0to3s = await busyWindow(page, cdp, 3000);

  await context.close();
  return out;
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
try {
  for (const n of sizes) {
    const res = await runOne(browser, n);
    console.log(JSON.stringify(res, null, 2));
  }
} finally {
  await browser.close();
}
