import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { syntheticStemma } from "../bench/syntheticStemma.mjs";
import { mockBackend } from "../bench/stemmaSource.mjs";

// Budgets for the canvas chart (#292/#311). Measured on GitHub's ubuntu runners
// (headless Chrome, software rendering) with headroom; a regression past them
// fails CI. Draw times come from the renderer's own timing, so they don't
// depend on how fast the runner happens to paint.
// First CI run (ubuntu-24.04): avg draw 0.27 / 0.35 / 0.82 ms, slowest 0.7 / 1 / 2.4 ms,
// hover 0.6 / 0.4 / 1.1 ms for 200 / 750 / 3000 people — budgets are ~5x that.
const BUDGETS: Record<number, { panDrawAvgMs: number; panDrawMaxMs: number; hoverMedianMs: number }> = {
  200: { panDrawAvgMs: 1.5, panDrawMaxMs: 8, hoverMedianMs: 3 },
  750: { panDrawAvgMs: 2, panDrawMaxMs: 10, hoverMedianMs: 3 },
  3000: { panDrawAvgMs: 4, panDrawMaxMs: 15, hoverMedianMs: 6 },
};
const IDLE_MAX_FRAMES = 1; // a settled chart draws nothing
const IDLE_MAX_BUSY_PCT = 5;

type ChartApi = {
  layout(): { ends: number; running: boolean; engine: string | null };
  /** frames: full scene draws; blits: gesture frames that only moved the snapshot */
  renderTiming(reset?: boolean): { frames: number; totalMs: number; maxMs: number; blits?: number };
  snapshot(): { nodes: Array<{ type: string; drawn: boolean; clientX: number; clientY: number }> };
};
declare global {
  interface Window {
    __stemmaChart?: ChartApi;
  }
}

const results: Record<string, unknown> = {};

async function busyPct(cdp: CDPSession, page: Page, ms: number) {
  const read = async () =>
    Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const a = await read();
  await page.waitForTimeout(ms);
  const b = await read();
  return ((b.TaskDuration - a.TaskDuration) / (ms / 1000)) * 100;
}

async function waitForRest(page: Page) {
  await page.waitForFunction(() => {
    const l = window.__stemmaChart?.layout();
    return !!l && l.ends > 0 && !l.running;
  }, undefined, { timeout: 120_000, polling: 250 });
}

for (const size of Object.keys(BUDGETS).map(Number)) {
  test(`chart with ${size} people stays within its performance budget`, async ({ page, context }) => {
    const stemma = syntheticStemma(size);
    await mockBackend(context, () => stemma);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    const budget = BUDGETS[size];

    await page.goto("/");
    await waitForRest(page);

    // Idle: once the layout rests nothing is drawn and the main thread is quiet.
    await page.evaluate(() => window.__stemmaChart!.renderTiming(true));
    const idleBusy = await busyPct(cdp, page, 2000);
    const idle = await page.evaluate(() => window.__stemmaChart!.renderTiming(true));

    // Pan: drag the canvas for about a second.
    const box = (await page.locator("canvas#chart").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 40; i++) {
      await page.mouse.move(cx + Math.sin(i / 6) * 300, cy + Math.cos(i / 6) * 150);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(100);
    const pan = await page.evaluate(() => window.__stemmaChart!.renderTiming(true));

    // Hover: synchronous cost of moving onto and off people.
    const hover = await page.evaluate(async () => {
      const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = document.querySelector("canvas#chart")!;
      const nodes = window.__stemmaChart!.snapshot().nodes.filter((n) => n.type === "person" && n.drawn);
      const times: number[] = [];
      for (let i = 0; i < 15; i++) {
        const n = nodes[Math.floor((i * nodes.length) / 15)];
        for (const at of [{ clientX: n.clientX, clientY: n.clientY }, { clientX: 2, clientY: 2 }]) {
          const t0 = performance.now();
          canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, ...at }));
          times.push(performance.now() - t0);
          await raf2();
        }
      }
      times.sort((a, b) => a - b);
      return times[times.length >> 1];
    });

    const measured = {
      idleFrames: idle.frames,
      idleBusyPct: Math.round(idleBusy * 10) / 10,
      // frames shown while panning: full draws plus snapshot moves (CanvasChart gesture snapshot)
      panFrames: pan.frames + (pan.blits ?? 0),
      panDrawAvgMs: Math.round((pan.totalMs / Math.max(pan.frames, 1)) * 100) / 100,
      panDrawMaxMs: Math.round(pan.maxMs * 100) / 100,
      hoverMedianMs: Math.round(hover * 100) / 100,
    };
    results[size] = { budget, measured };
    console.log(`perf ${size} people`, JSON.stringify(measured));

    expect.soft(measured.idleFrames, "frames drawn while idle").toBeLessThanOrEqual(IDLE_MAX_FRAMES);
    expect.soft(measured.idleBusyPct, "main-thread busy % while idle").toBeLessThanOrEqual(IDLE_MAX_BUSY_PCT);
    expect.soft(measured.panFrames, "frames drawn during the pan").toBeGreaterThan(10);
    expect.soft(measured.panDrawAvgMs, "average draw time while panning").toBeLessThanOrEqual(budget.panDrawAvgMs);
    expect.soft(measured.panDrawMaxMs, "slowest frame while panning").toBeLessThanOrEqual(budget.panDrawMaxMs);
    expect.soft(measured.hoverMedianMs, "median hover handler").toBeLessThanOrEqual(budget.hoverMedianMs);
  });
}

test.afterAll(() => {
  mkdirSync("perf-results", { recursive: true });
  writeFileSync("perf-results/summary.json", JSON.stringify(results, null, 2));
});
