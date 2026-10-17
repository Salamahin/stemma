// CPU-profiles 3 s of steady state and prints the top self-time functions.
//   node bench/profileBench.mjs 1000
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
const cdp = await context.newCDPSession(page);
await page.goto(BASE);
await page.waitForTimeout(6000);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.start");
await page.waitForTimeout(3000);
const { profile } = await cdp.send("Profiler.stop");
const self = new Map();
const dt = profile.timeDeltas;
const byId = new Map(profile.nodes.map((x) => [x.id, x]));
const counts = new Map();
for (const s of profile.samples) counts.set(s, (counts.get(s) ?? 0) + 1);
let total = 0;
for (const [id, c] of counts) {
  const nd = byId.get(id);
  const f = nd.callFrame;
  const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber}:${f.columnNumber}`;
  self.set(key, (self.get(key) ?? 0) + c);
  total += c;
}
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [k, c] of top) console.log(((c / total) * 100).toFixed(1).padStart(5) + "%  " + k);
// heaviest stacks
const parent = new Map();
for (const nd of profile.nodes) for (const c of nd.children ?? []) parent.set(c, nd.id);
const stacks = new Map();
for (const [id, c] of counts) {
  const chain = [];
  let cur = id;
  while (cur != null && chain.length < 12) {
    const f = byId.get(cur).callFrame;
    if (f.functionName !== "(root)") chain.push(`${f.functionName || "anon"}@${f.columnNumber}`);
    cur = parent.get(cur);
  }
  const k = chain.join(" < ");
  stacks.set(k, (stacks.get(k) ?? 0) + c);
}
for (const [k, c] of [...stacks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(((c / total) * 100).toFixed(1) + "%  " + k);
await browser.close();
