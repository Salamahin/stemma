// Seed experiments: current generational-row seed vs the structured seed,
// each followed by the force refine, on a synthetic size or a Stemma JSON.
//   (cd ../frontend && npx rollup -c bench.rollup.config.mjs) is NOT needed:
//   this script bundles frontend/src/{structuredLayout,layoutCore}.ts itself.
//   node bench/seedExperiment.mjs <people|stemma.json>
import { rollup } from "../../frontend/node_modules/rollup/dist/es/rollup.js";
import typescript from "../../frontend/node_modules/@rollup/plugin-typescript/dist/es/index.js";
import resolve from "../../frontend/node_modules/@rollup/plugin-node-resolve/dist/es/index.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadStemma } from "./stemmaSource.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolvePath(here, "../../frontend");
const tmp = mkdtempSync(join(tmpdir(), "seed-exp-"));
const entry = join(tmp, "entry.ts");
writeFileSync(entry, `export { structuredLayout } from ${JSON.stringify(join(frontend, "src/structuredLayout.ts"))};
export { createLayoutSimulation } from ${JSON.stringify(join(frontend, "src/layoutCore.ts"))};
export { computeInitialLayout } from ${JSON.stringify(join(frontend, "src/initialLayout.ts"))};
export { StemmaIndex } from ${JSON.stringify(join(frontend, "src/stemmaIndex.ts"))};
export { makeNodesAndRelations } from ${JSON.stringify(join(frontend, "src/graphTools.js"))};
`);
const bundle = await rollup({
  input: entry,
  plugins: [resolve({ rootDir: frontend, modulePaths: [join(frontend, "node_modules")] }), typescript({ tsconfig: join(frontend, "tsconfig.json"), include: [join(frontend, "src/**/*"), entry], noEmitOnError: false, compilerOptions: { verbatimModuleSyntax: false } })],
  onwarn: () => {},
});
const out = join(tmp, "bundle.mjs");
await bundle.write({ file: out, format: "es" });
const lib = await import(out);

const stemma = loadStemma(process.argv[2] ?? "1000");
const W = 1440, H = 900;

function graph() {
  const [nodes, links] = lib.makeNodesAndRelations(stemma.people, stemma.families);
  return { nodes, links };
}

function quality(nodes, links) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const people = nodes.filter((n) => n.type === "person");
  const cell = 40, grid = new Map();
  for (const p of people) { const k = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(p); }
  let overlaps = 0;
  for (const p of people) {
    const gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of grid.get(`${gx + dx}:${gy + dy}`) ?? []) if (q.id > p.id && Math.hypot(p.x - q.x, p.y - q.y) < 40) overlaps++;
  }
  const segs = links.map((l) => { const a = byId.get(typeof l.source === "string" ? l.source : l.source.id), b = byId.get(typeof l.target === "string" ? l.target : l.target.id); return { s: a.id, t: b.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y }; });
  const lens = segs.map((g) => Math.hypot(g.x2 - g.x1, g.y2 - g.y1)).sort((a, b) => a - b);
  const bucket = Math.max(200, lens[Math.floor(lens.length * 0.9)] || 200);
  const sg = new Map();
  segs.forEach((g, i) => {
    const x0 = Math.floor(Math.min(g.x1, g.x2) / bucket), x1 = Math.floor(Math.max(g.x1, g.x2) / bucket);
    const y0 = Math.floor(Math.min(g.y1, g.y2) / bucket), y1 = Math.floor(Math.max(g.y1, g.y2) / bucket);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) return;
    for (let xx = x0; xx <= x1; xx++) for (let yy = y0; yy <= y1; yy++) { const k = `${xx}:${yy}`; (sg.get(k) ?? sg.set(k, []).get(k)).push(i); }
  });
  const orient = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  const seen = new Set(); let crossings = 0;
  for (const ids of sg.values()) for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const i = Math.min(ids[a], ids[b]), j = Math.max(ids[a], ids[b]), key = i * 1e6 + j;
    if (seen.has(key)) continue; seen.add(key);
    const p = segs[i], q = segs[j];
    if (p.s === q.s || p.s === q.t || p.t === q.s || p.t === q.t) continue;
    if (orient(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1) * orient(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2) < 0 && orient(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1) * orient(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2) < 0) crossings++;
  }
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  return { overlaps, crossings, medianLink: Math.round(lens[lens.length >> 1]), p95Link: Math.round(lens[Math.floor(lens.length * 0.95)]), w: Math.round(Math.max(...xs) - Math.min(...xs)), h: Math.round(Math.max(...ys) - Math.min(...ys)) };
}

function refine(nodes, links, alpha) {
  const sim = lib.createLayoutSimulation(nodes, links, W, H);
  sim.alpha(alpha);
  const t0 = performance.now();
  let ticks = 0;
  while (sim.alpha() >= sim.alphaMin()) { sim.tick(); ticks++; }
  return { ticks, ms: Math.round(performance.now() - t0) };
}

function seedCurrent() {
  const g = graph();
  const index = new lib.StemmaIndex({ type: "Stemma", people: stemma.people, families: stemma.families });
  const t0 = performance.now();
  const init = lib.computeInitialLayout(index, stemma.people, stemma.families, W, H);
  const ms = Math.round(performance.now() - t0);
  for (const n of g.nodes) [n.x, n.y] = init.get(n.id) ?? [W / 2, H / 2];
  return { ...g, seedMs: ms };
}

function seedStructured(options) {
  const g = graph();
  const idx = new Map(g.nodes.map((n, i) => [n.id, i]));
  const pairs = [];
  for (const l of g.links) pairs.push(idx.get(l.source), idx.get(l.target));
  const t0 = performance.now();
  const { x, y } = lib.structuredLayout({ ids: g.nodes.map((n) => n.id), links: Int32Array.from(pairs), center: [W / 2, H / 2] }, options);
  const ms = Math.round(performance.now() - t0);
  g.nodes.forEach((n, i) => { n.x = x[i]; n.y = y[i]; });
  return { ...g, seedMs: ms };
}

console.log(`people=${stemma.people.length} families=${stemma.families.length}`);
const variants = process.env.SPACING
  ? [
      ["structured default, alpha 1", () => seedStructured(), 1],
      ["spacing 70/30/140, alpha 1", () => seedStructured({ personSpacing: 70, familySpacing: 30, generationGap: 140 }), 1],
      ["spacing 50/20/110, alpha 1", () => seedStructured({ personSpacing: 50, familySpacing: 20, generationGap: 110 }), 1],
      ["spacing 70/30/140, alpha 0.5", () => seedStructured({ personSpacing: 70, familySpacing: 30, generationGap: 140 }), 0.5],
      ["sweeps 2, alpha 1", () => seedStructured({ sweeps: 2 }), 1],
      ["sweeps 0, alpha 1", () => seedStructured({ sweeps: 0 }), 1],
    ]
  : [
      ["current seed, alpha 1", () => seedCurrent(), 1],
      ["structured seed (no refine)", () => seedStructured(), 0],
      ["structured, alpha 1", () => seedStructured(), 1],
      ["structured, alpha 0.3", () => seedStructured(), 0.3],
      ["structured, alpha 0.1", () => seedStructured(), 0.1],
    ];
for (const [name, seed, alpha] of variants) {
  const g = seed();
  const r = alpha > 0 ? refine(g.nodes, g.links, alpha) : { ticks: 0, ms: 0 };
  console.log(name.padEnd(30), `seed ${String(g.seedMs).padStart(5)} ms  refine ${String(r.ticks).padStart(3)} ticks ${String(r.ms).padStart(6)} ms `, JSON.stringify(quality(g.nodes, g.links)));
}
