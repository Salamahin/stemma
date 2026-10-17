// Cost of the d3fc greedy label placement used when the layout settles.
//   node bench/labelLayoutCost.mjs 1000
import * as d3 from "../../frontend/node_modules/d3/src/index.js";
import { layoutGreedy, layoutRemoveOverlaps } from "../../frontend/node_modules/d3fc-label-layout/build/d3fc-label-layout.js";

const n = Number(process.argv[2] ?? 1000);
const rnd = d3.randomLcg(1);
const rects = d3.range(n).map(() => ({ hidden: false, x: rnd() * 12000, y: rnd() * 11000, width: 110, height: 22 }));
const t0 = performance.now();
const placed = layoutRemoveOverlaps(layoutGreedy())(rects.map((r) => ({ ...r })));
console.log(`n=${n} greedy+removeOverlaps: ${Math.round(performance.now() - t0)} ms, hidden=${placed.filter((r) => r.hidden).length}`);
