// Visual check of edit-mode affordances (ghosts, drag overlay, drop states).
//   node bench/editShots.mjs <outPrefix>
import { chromium } from "@playwright/test";
import { syntheticStemma } from "./syntheticStemma.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const out = process.argv[2] ?? "/tmp/stemma-edit";
const stemma = syntheticStemma(12);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
await context.route("https://accounts.google.com/**", (r) => r.fulfill({ status: 200, body: "" }));
await context.route("http://bench.invalid/**", async (route) => {
  const body = JSON.parse(route.request().postData() || "{}");
  const resp = body.type === "AuthLoginRequest"
    ? { type: "AuthLoginResponse", userId: "u", email: "b@l" }
    : { type: "OwnedStemmas", stemmas: [{ type: "StemmaDescription", id: "bench", name: "bench", removable: true }], firstStemma: stemma };
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resp) });
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(BASE);
await page.waitForTimeout(6000);
await page.getByTestId("edit-fab").click();
await page.waitForTimeout(800);

const centre = async (pred) => page.evaluate((src) => {
  const f = new Function("n", `return (${src})(n)`);
  const api = window.__stemmaChart;
  if (api) {
    const n = api.snapshot().nodes.find((x) => x.drawn && f(x));
    return n ? { x: n.clientX, y: n.clientY } : null;
  }
  const g = [...document.querySelectorAll("#chart g[id^='person_'], #chart g[id^='family_']")].find((el) =>
    f({ id: el.id, type: el.id.startsWith("person_") ? "person" : "family", name: el.querySelector("text")?.textContent ?? null }));
  if (!g) return null;
  const r = g.querySelector("circle").getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, pred.toString());

const person = await centre((n) => n.type === "person" && n.id === "person_p3");
await page.mouse.move(person.x, person.y);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}-ghosts.png` });

await page.mouse.move(5, 400);
await page.waitForTimeout(600);
const src = await centre((n) => n.id === "person_p5");
const fam = await centre((n) => n.id === "family_f0");
await page.mouse.move(src.x, src.y);
await page.mouse.down();
await page.mouse.move(src.x + 20, src.y + 20, { steps: 4 });
await page.mouse.move(fam.x, fam.y, { steps: 10 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}-drag.png` });
await page.mouse.move(fam.x + 200, fam.y + 150, { steps: 10 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}-drag-empty.png` });
await page.keyboard.press("Escape");
await browser.close();
