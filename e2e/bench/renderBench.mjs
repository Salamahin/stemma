// Rendering/layout benchmark for the family graph.
//
//   cd frontend && E2E_AUTO_LOGIN=1 GOOGLE_CLIENT_ID=bench STEMMA_BACKEND_URL=http://bench.invalid npm run build
//   npx sirv public --port 4180 --single &          (from frontend/)
//   cd e2e && node bench/renderBench.mjs 300 1000
//
// The backend is mocked with page.route, so no Docker/DynamoDB is needed.
// Uses the locally installed Chrome (channel "chrome").
//
// Per size, for a cold load (empty layout cache) and a warm reload (cache
// filled by the cold run):
//   firstDrawMs   time origin → first frame with nodes on the canvas
//   settleMs      time origin → layout end (null if it never ended in 30 s)
//   loadBusyPct   main-thread busy % from navigation until settle (or 30 s)
//   idle          busy % / fps over 3 s after settle (idle CPU)
// plus hover cost in view mode.
import { chromium } from "@playwright/test";
import { syntheticStemma } from "./syntheticStemma.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const SETTLE_TIMEOUT_MS = 30_000;
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

function busy(a, b, sec) {
  return {
    busyPct: r1(((b.TaskDuration - a.TaskDuration) / sec) * 100),
    scriptMsPerSec: r1(((b.ScriptDuration - a.ScriptDuration) * 1000) / sec),
  };
}

async function busyWindow(page, cdp, ms) {
  const a = await metrics(cdp);
  const f0 = await page.evaluate(() => window.__frames.length);
  await page.waitForTimeout(ms);
  const b = await metrics(cdp);
  const frames = await page.evaluate((f0) => window.__frames.length - f0, f0);
  return { ...busy(a, b, ms / 1000), fps: r1(frames / (ms / 1000)) };
}

/** Loads (or reloads) the page and measures first draw, settle and load-time CPU. */
async function load(page, cdp, people, reload) {
  const m0 = await metrics(cdp);
  const w0 = Date.now();
  if (reload) await page.reload();
  else await page.goto(BASE);
  await page.waitForFunction(`(${PERSON_COUNT_SRC})() === ${people}`, null, { timeout: 120000 });
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let layout = null;
  while (Date.now() < deadline) {
    layout = await page.evaluate(() => {
      const api = window.__stemmaChart;
      const l = api?.layout?.();
      return l ? { ...l, now: performance.now() } : null;
    });
    if (layout && layout.ends > 0 && layout.lastEndAt >= layout.lastTickAt && layout.now - layout.lastEndAt > 300) break;
    layout = layout ? { ...layout, unsettled: true } : null;
    await page.waitForTimeout(100);
  }
  const m1 = await metrics(cdp);
  const settled = layout && !layout.unsettled;
  const windowSec = (Date.now() - w0) / 1000;
  return {
    firstDrawMs: layout?.firstDrawAt ? Math.round(layout.firstDrawAt) : null,
    settleMs: settled ? Math.round(layout.lastEndAt) : null,
    layoutTicks: layout?.ticks ?? null,
    loadBusyPct: busy(m0, m1, windowSec).busyPct,
  };
}

async function hover(page) {
  return await page.evaluate(async () => {
    const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const api = window.__stemmaChart;
    const canvas = document.querySelector("canvas#chart");
    const targets = api
      ? api.snapshot().nodes.filter((n) => n.type === "person" && n.drawn)
      : [...document.querySelectorAll("#chart g[id^='person_']")];
    const pick = [];
    for (let i = 0; i < 15; i++) pick.push(targets[Math.floor((i * targets.length) / 15)]);
    const sync = [];
    for (const g of pick) {
      for (const type of ["mouseenter", "mouseleave"]) {
        const a = performance.now();
        if (api) {
          const at = type === "mouseenter" ? { clientX: g.clientX, clientY: g.clientY } : { clientX: 2, clientY: 2 };
          canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, ...at }));
        } else {
          g.dispatchEvent(new MouseEvent(type, { bubbles: false }));
        }
        sync.push(performance.now() - a);
        await raf2();
      }
    }
    return sync;
  });
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
  out.cold = await load(page, cdp, stemma.people.length, false);
  out.cold.idle = await busyWindow(page, cdp, 3000);
  out.hoverSyncMedianMs = r1(median(await hover(page)));
  await page.waitForTimeout(1500); // let the debounced layout-cache save land
  out.warm = await load(page, cdp, stemma.people.length, true);
  out.warm.idle = await busyWindow(page, cdp, 3000);

  await context.close();
  return out;
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
try {
  for (const n of sizes) {
    const res = await runOne(browser, n);
    console.log(JSON.stringify(res));
  }
} finally {
  await browser.close();
}
