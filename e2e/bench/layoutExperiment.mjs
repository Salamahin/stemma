// Headless d3-force experiments: how fast does a parameter set converge, and
// how close is the result to the reference (today's) layout?
//   node bench/layoutExperiment.mjs 1000
import * as d3 from "../../frontend/node_modules/d3/src/index.js";
import { syntheticStemma } from "./syntheticStemma.mjs";

const N = Number(process.argv[2] ?? 1000);
const W = 1440, H = 900;
const stemma = syntheticStemma(N);

// --- generation seeding, same as frontend/src/initialLayout.ts -------------
function generations(st) {
  const parentsOf = new Map();
  for (const f of st.families) for (const c of f.children) parentsOf.set(c, [...(parentsOf.get(c) ?? []), ...f.parents]);
  const memo = new Map();
  const gen = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = parentsOf.get(id) ?? [];
    const g = ps.length ? 1 + Math.max(...ps.map((p) => gen(p, seen))) : 0;
    memo.set(id, g);
    return g;
  };
  return { gen, parentsOf };
}
function initialLayout(st) {
  const { gen, parentsOf } = generations(st);
  const pos = new Map();
  const byGen = new Map();
  let maxGen = 0;
  for (const p of st.people) {
    const g = gen(p.id);
    maxGen = Math.max(maxGen, g);
    byGen.set(g, [...(byGen.get(g) ?? []), p.id]);
  }
  const topY = H / 2 - (Math.max(maxGen, 1) * 200) / 2;
  const ax = new Map();
  for (const g of [...byGen.keys()].sort((a, b) => a - b)) {
    const ids = byGen.get(g);
    const t = new Map();
    for (const id of ids) {
      const xs = (parentsOf.get(id) ?? []).map((p) => ax.get(p)).filter((v) => v !== undefined);
      if (xs.length) t.set(id, xs.reduce((s, x) => s + x, 0) / xs.length);
    }
    ids.sort((a, b) => {
      const ta = t.get(a), tb = t.get(b);
      if (ta !== undefined && tb !== undefined) return ta - tb || a.localeCompare(b);
      if (ta !== undefined) return -1;
      if (tb !== undefined) return 1;
      return a.localeCompare(b);
    });
    const startX = W / 2 - (Math.max(ids.length - 1, 0) * 160) / 2;
    ids.forEach((id, i) => {
      ax.set(id, startX + i * 160);
      pos.set("person_" + id, [startX + i * 160, topY + g * 200]);
    });
  }
  for (const f of st.families) {
    const pts = [...f.parents, ...f.children].map((id) => pos.get("person_" + id)).filter(Boolean);
    pos.set("family_" + f.id, pts.length ? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] : [W / 2, H / 2]);
  }
  return pos;
}

function graph() {
  const nodes = [
    ...stemma.people.map((p) => ({ id: "person_" + p.id, type: "person" })),
    ...stemma.families.map((f) => ({ id: "family_" + f.id, type: "family" })),
  ];
  const links = [
    ...stemma.families.flatMap((f) => f.children.map((c) => ({ source: "family_" + f.id, target: "person_" + c }))),
    ...stemma.families.flatMap((f) => f.parents.map((p) => ({ source: "person_" + p, target: "family_" + f.id }))),
  ];
  const init = initialLayout(stemma);
  for (const n of nodes) [n.x, n.y] = init.get(n.id);
  return { nodes, links };
}

function makeSim(nodes, links, p) {
  const charge = d3.forceManyBody().strength(-1500).distanceMin(85).theta(p.theta ?? 0.9);
  if (p.distanceMax) charge.distanceMax(p.distanceMax);
  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((n) => n.id).strength(2).distance(85))
    .force("x", d3.forceX(W / 2).strength(0.05))
    .force("y", d3.forceY(H / 2).strength(0.05))
    .force("repelForce", charge)
    .velocityDecay(p.velocityDecay ?? 0.8)
    .alphaDecay(p.alphaDecay ?? 1 - Math.pow(0.001, 1 / 300))
    .alphaMin(p.alphaMin ?? 0.001)
    .alphaTarget(p.alphaTarget ?? 0)
    .stop();
  return sim;
}

function quality(nodes, links) {
  const people = nodes.filter((n) => n.type === "person");
  let overlaps = 0;
  const qt = d3.quadtree(people, (d) => d.x, (d) => d.y);
  for (const a of people) {
    qt.visit((q, x0, y0, x1, y1) => {
      if (!q.length) {
        let l = q;
        do {
          const b = l.data;
          if (b !== a && b.id > a.id && Math.hypot(a.x - b.x, a.y - b.y) < 40) overlaps++;
        } while ((l = l.next));
      }
      return x0 > a.x + 40 || x1 < a.x - 40 || y0 > a.y + 40 || y1 < a.y - 40;
    });
  }
  const lens = links.map((l) => Math.hypot(l.source.x - l.target.x, l.source.y - l.target.y)).sort((a, b) => a - b);
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  return {
    overlaps,
    medianLink: Math.round(lens[lens.length >> 1]),
    p95Link: Math.round(lens[Math.floor(lens.length * 0.95)]),
    w: Math.round(Math.max(...xs) - Math.min(...xs)),
    h: Math.round(Math.max(...ys) - Math.min(...ys)),
  };
}

/** Runs until alpha < alphaMin (or maxTicks); reports ticks, ms, and when motion stopped. */
function run(name, p, maxTicks = 3000) {
  const { nodes, links } = graph();
  const sim = makeSim(nodes, links, p);
  const t0 = performance.now();
  let ticks = 0;
  let calmAt = null;
  while (ticks < maxTicks && (sim.alpha() >= sim.alphaMin() || p.alphaTarget)) {
    sim.tick();
    ticks++;
    let maxV = 0;
    for (const n of nodes) maxV = Math.max(maxV, Math.abs(n.vx), Math.abs(n.vy));
    if (calmAt === null && maxV < 0.5) calmAt = ticks;
    if (calmAt !== null && maxV >= 0.5) calmAt = null;
  }
  const ms = performance.now() - t0;
  console.log(name.padEnd(28), `ticks=${String(ticks).padStart(4)} ms=${String(Math.round(ms)).padStart(5)} ms/tick=${(ms / ticks).toFixed(2)} calm@${calmAt}`, JSON.stringify(quality(nodes, links)));
  return { nodes, links };
}

const decay = (t) => 1 - Math.pow(0.001, 1 / t);
console.log(`people=${stemma.people.length} families=${stemma.families.length}`);
const variants = process.env.VARIANTS ?? "all";
if (variants === "all") {
  run("reference (vd0.8, target0.1, 3000t)", { alphaTarget: 0.1 }, 3000);
  run("today w/o target", {});
  for (const vd of [0.4, 0.5, 0.6]) run(`vd${vd}`, { velocityDecay: vd });
  for (const vd of [0.4, 0.5]) for (const ticks of [150, 200]) run(`vd${vd} ${ticks}t`, { velocityDecay: vd, alphaDecay: decay(ticks) });
  for (const dm of [800, 1200]) run(`vd0.5 200t dmax${dm}`, { velocityDecay: 0.5, alphaDecay: decay(200), distanceMax: dm });
  run("vd0.5 200t theta1.2", { velocityDecay: 0.5, alphaDecay: decay(200), theta: 1.2 });
} else {
  run("reference (vd0.8, target0.1, 3000t)", { alphaTarget: 0.1 }, 3000);
  for (const t of [200, 250, 300]) run(`vd0.4 ${t}t theta1.2`, { velocityDecay: 0.4, alphaDecay: decay(t), theta: 1.2 });
  for (const t of [200, 300]) run(`vd0.3 ${t}t theta1.2`, { velocityDecay: 0.3, alphaDecay: decay(t), theta: 1.2 });
  run(`vd0.4 300t theta1.2 amin.005`, { velocityDecay: 0.4, alphaDecay: 1 - Math.pow(0.005, 1 / 300), alphaMin: 0.005, theta: 1.2 });
}
