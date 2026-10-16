// Which layout engine is active, and does the layout finish? Prints console errors.
//   node bench/engineProbe.mjs 300
import { chromium } from "@playwright/test";
import { syntheticStemma } from "./syntheticStemma.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const n = Number(process.argv[2] ?? 300);
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
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`console ${m.type()}:`, m.text()); });
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(BASE);
await page.waitForTimeout(3000);
console.log(JSON.stringify(await page.evaluate(() => window.__stemmaChart?.layout())));
await browser.close();
