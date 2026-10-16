// Visual check: renders a synthetic stemma and saves screenshots.
//   node bench/screenshot.mjs <people> <outPrefix>
import { chromium } from "@playwright/test";
import { syntheticStemma } from "./syntheticStemma.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const n = Number(process.argv[2] ?? 60);
const out = process.argv[3] ?? "/tmp/stemma-shot";
const stemma = syntheticStemma(n);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await context.route("https://accounts.google.com/**", (r) => r.fulfill({ status: 200, body: "" }));
await context.route("http://bench.invalid/**", async (route) => {
  const body = JSON.parse(route.request().postData() || "{}");
  const resp = body.type === "AuthLoginRequest"
    ? { type: "AuthLoginResponse", userId: "u", email: "b@l" }
    : { type: "OwnedStemmas", stemmas: [{ type: "StemmaDescription", id: "bench", name: "bench", removable: true }], firstStemma: stemma };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp) });
});
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text()); });
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(BASE);
await page.waitForTimeout(8000);
await page.screenshot({ path: `${out}-idle.png` });
const target = await page.evaluate(() => {
  const api = window.__stemmaChart;
  if (api) {
    const p = api.snapshot().nodes.find((x) => x.type === "person" && x.drawn && x.name);
    return p ? { x: p.clientX, y: p.clientY } : null;
  }
  const g = document.querySelector("#chart g[id^='person_'] circle");
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
if (target) {
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}-hover.png` });
}
await browser.close();
