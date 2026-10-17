// Measures how far nodes still drift after the layout should have settled.
//   node bench/motionProbe.mjs 1000
import { chromium } from "@playwright/test";
import { syntheticStemma } from "./syntheticStemma.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const n = Number(process.argv[2] ?? 1000);
const stemma = syntheticStemma(n);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.route("https://accounts.google.com/**", (r) => r.fulfill({ status: 200, body: "" }));
await context.route("http://bench.invalid/**", async (route) => {
  const body = JSON.parse(route.request().postData() || "{}");
  const resp = body.type === "AuthLoginRequest"
    ? { type: "AuthLoginResponse", userId: "u", email: "b@l" }
    : { type: "OwnedStemmas", stemmas: [{ type: "StemmaDescription", id: "bench", name: "bench", removable: true }], firstStemma: stemma };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp) });
});
const page = await context.newPage();
await page.goto(BASE);
const pos = () => page.evaluate(() => Object.fromEntries(window.__stemmaChart.snapshot().nodes.map((x) => [x.id, [x.x, x.y]])));
for (const t of [3, 6, 10, 15, 20]) {
  await page.waitForTimeout(t === 3 ? 3000 : (t - [3, 6, 10, 15, 20][[3, 6, 10, 15, 20].indexOf(t) - 1]) * 1000 - 1000);
  const a = await pos();
  await page.waitForTimeout(1000);
  const b = await pos();
  const d = Object.keys(a).map((k) => Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1])).sort((x, y) => x - y);
  console.log(`t=${t}s  movement per second: median ${d[d.length >> 1].toFixed(3)}  p95 ${d[Math.floor(d.length * 0.95)].toFixed(3)}  max ${d[d.length - 1].toFixed(3)}`);
}
await browser.close();
