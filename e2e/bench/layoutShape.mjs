// Whole-graph overview: loads a synthetic stemma, waits, and renders all node
// positions (dots + edges) fitted into one PNG, plus layout quality numbers.
//   node bench/layoutShape.mjs <people> <waitMs> <out.png>
import { chromium } from "@playwright/test";
import { syntheticStemma } from "./syntheticStemma.mjs";

const BASE = process.env.BENCH_URL ?? "http://127.0.0.1:4180/";
const n = Number(process.argv[2] ?? 300);
const waitMs = Number(process.argv[3] ?? 5000);
const out = process.argv[4] ?? "/tmp/layout-shape.png";
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
await page.waitForTimeout(waitMs);
const snap = await page.evaluate(() => window.__stemmaChart.snapshot());
const pos = new Map(snap.nodes.map((x) => [x.id, x]));
const xs = snap.nodes.map((x) => x.x), ys = snap.nodes.map((x) => x.y);
const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
const people = snap.nodes.filter((x) => x.type === "person");
let overlaps = 0;
for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++)
  if (Math.hypot(people[i].x - people[j].x, people[i].y - people[j].y) < 40) overlaps++;
const lens = snap.edges.map((e) => Math.hypot(pos.get(e.source).x - pos.get(e.target).x, pos.get(e.source).y - pos.get(e.target).y)).sort((a, b) => a - b);
console.log(JSON.stringify({ w: Math.round(maxX - minX), h: Math.round(maxY - minY), overlaps, medianLink: Math.round(lens[lens.length >> 1]), p95Link: Math.round(lens[Math.floor(lens.length * 0.95)]) }));

const S = 900, pad = 20;
const k = (S - 2 * pad) / Math.max(maxX - minX, maxY - minY);
const tx = (x) => pad + (x - minX) * k, ty = (y) => pad + (y - minY) * k;
const lines = snap.edges.map((e) => `<line x1="${tx(pos.get(e.source).x)}" y1="${ty(pos.get(e.source).y)}" x2="${tx(pos.get(e.target).x)}" y2="${ty(pos.get(e.target).y)}" stroke="#999" stroke-width="0.6"/>`).join("");
const dots = snap.nodes.map((x) => `<circle cx="${tx(x.x)}" cy="${ty(x.y)}" r="${x.type === "person" ? 2.2 : 1.2}" fill="${x.type === "person" ? "#3b2a8f" : "#326f93"}"/>`).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="100%" height="100%" fill="white"/>${lines}${dots}</svg>`;
const p2 = await context.newPage();
await p2.setViewportSize({ width: S, height: S });
await p2.setContent(`<body style="margin:0">${svg}</body>`);
await p2.screenshot({ path: out });
await browser.close();
