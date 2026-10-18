# Frontend — editor UI

Single-version Svelte 5 (runes) UI. `main.ts` mounts `App.svelte` at every path. Edit mode toggles drag gestures + ghost affordances on the chart canvas.

## Chart rendering

The family graph is drawn on `<canvas id="chart">` by `canvasChart.ts` (Canvas2D), not SVG — there is no per-node DOM.

- `FullStemma.svelte` owns the layout engine, d3.zoom/d3.drag on the canvas, and hover highlight; it hands the `CanvasChart` to the other components via `onchartReady` → `chart` prop.
- **The force layout runs in a Web Worker** (`layoutEngine.ts` → `layout.worker.ts` / `layoutWorkerHost.ts`, messages in `layoutProtocol.ts`). The worker is bundled by the rollup `inlineLayoutWorker` plugin and embedded in `bundle.js` as a string (`virtual:layout-worker`, started from a Blob URL), so deploys still ship one hashed JS file. Where `Worker` is missing (jest/jsdom) or fails to start, `InlineLayoutEngine` runs the same `LayoutLoop` (`layoutCore.ts`) on the main thread. The engine writes positions into the `ChartNode` objects the canvas draws; nodes with `fx`/`fy` set on the main thread (drag, edit-mode pins) stay main-thread authoritative — after changing pins call `engine.syncFixed()` / `engine.pin(node)`.
- **Ghost burst stays on the main thread** (`GhostLayer.svelte`): its own short d3 simulation with frozen copies of all real nodes and links plus the ghosts, using the same forces (`applyLayoutForces`). It is interactive (focus/hover/click need positions in the same frame) and the main layout is stopped in edit mode anyway.
- The renderer draws on demand (one rAF per invalidation: sim tick, zoom, hover/style change, running fade/pulse) and culls off-screen nodes. Edges/arrows are batched per style; the blurred clan clouds are rasterised into an offscreen bitmap and only re-rasterised when positions change (≤10/s during the sim).
- Level of detail (large stemmas, zoomed out): arrowheads under ~2 device px are skipped; filled shapes go in batches of `FILL_BATCH` (one path with thousands of tiny triangles cost ~300 ms/frame in Chrome's GPU rasteriser on an 11k stemma); plain nodes are filled per colour (squares when sub-pixel); clan labels are cached sprites keyed by on-screen font size (quarter-octave steps) and skipped below 3 device px. Measure with `e2e/bench/zoomBench.mjs <people|stemma.json>`.
- Hit-testing goes through `chart.hitNode(clientX, clientY)` (quadtree; circle or name label, like the old `<g>`), `chart.hitGhost`, `chart.clientToWorld`. Visual states that used to be CSS classes are renderer state: `setPendingMarks`, `setDropClasses`, `setDropTarget`, `setGestureSource`, `setOverlay`, `showGhosts`.
- The main sim's collide force only sees datums with an `r` (`forceCollideSized`); real nodes have none, ghosts and their focused neighbours get one. Do not go back to `forceCollide().radius(d => d.r * 20)` over all nodes — NaN radii disable quadtree pruning and made every tick O(n²).
- The layout must end: no permanent `alphaTarget` (it kept the sim — and the CPU — busy forever). Tuning lives in `layoutCore.ts` (`LAYOUT_*`; ~200 ticks, velocityDecay 0.3, theta 1.2), chosen with `e2e/bench/layoutExperiment.mjs` to match the old equilibrium. `LayoutLoop` paces a settle so those ticks take about `LAYOUT_SETTLE_MS` (4 s) on screen instead of snapping into place (#307); when ticks are slower than the pace (big stemmas, slow machines) it runs batches back to back, so pacing never slows a layout down. Person-label placement on layout end is `labelLayout.ts` (grid-indexed greedy over 8 placements × 3 distances, avoiding other labels and person circles). It never hides a label — d3fc's removeOverlaps did, silently dropping names in dense families (#300); hiding is only a uniform zoom-level rule.
- Cold start (no/too little remembered layout): the engine seeds unfixed nodes with `structuredLayout.ts` (in the worker) before the force refine. Default mode `star` (fewest crossings): stemmas are almost trees (real 11k stemma: 76 independent cycles over 16k nodes), so a BFS spanning tree rooted at its centroid is drawn as a radial tree — each subtree gets an angular wedge proportional to its leaf count, each depth a ring just large enough for `starSpacing` between neighbours; a greedy search over child orders shortens the chords of the few non-tree edges (they cause most remaining crossings). All real nodes collide during the refine (`giveCollisionRadius`). The seed rings are global per depth, so one crowded generation stretches every edge of it; a fresh star seed therefore refines **without anchors** (centre pull only) so those edges can shorten, and nodes get anchors only when that refine comes to rest (`anchorAtRest`: chosen so the anchor pull equals the centre pull they rested under — anchoring at the rest position itself drops that inward force and the next refine spreads the graph out). Real 11k stemma (`seedExperiment.mjs` `starFree` vs `starRefined`): p95 edge 2119 → 650, median edge 198 → 143, person overlaps 592 → 25, ~200k → 44k wide, at 1.25k crossings instead of 849 and surname-cloud overlap 0.26 instead of 0.22. Alternative mode `clans` keeps the clouds apart instead (overlap 0.004, ~5.6k crossings): every node joins its nearest surname clan (`clanRegions`, multi-source BFS from the clan members the main thread passes as `groups`); each clan region is laid out with generation rings (longest path over the family DAG, married-in spouses on their partner's generation, DFS + barycenter ordering with spouse blocks); regions start at their clan's centroid in a rings layout of the whole component and are pushed apart by a small region-graph layout (`regionGap`); components are packed with `d3.packSiblings`; the layout is re-centred on a person. The chart is `hold()`-ed until the seeded positions arrive, and a newly opened stemma pans to the nearest person if the view would be empty.
- Refine physics: nodes are pulled to stable anchors (`ax`/`ay`: clans seed / end of a star refine / first position / drop position; remembered in the layout cache and the session) instead of the viewport centre — the centre pull is what squeezed clan regions into one disc. Anchors are not reset when the layout rests (that drops the spring tension balancing repulsion and the graph would grow on every refine). d3's forceX/forceY cache their targets when initialised: after changing anchors on a running simulation call `refreshAnchors(sim)` (drop after a drag, `moveTo`, anchoring at rest), or the old anchors keep pulling. Links between different clan regions pull at 0.005 instead of 2, so related clans sit near each other without being dragged together. Real 11k stemma: surname-cloud overlap 0.80 (original) / 0.32 (rings seed) → 0.004, at ~1.5× the size and ~4× the rings seed's crossings (`e2e/bench/seedExperiment.mjs`).
- Layout memory: `NodeLayoutCache` keeps positions per stemma in localStorage under `nodeLayout.v2.<id>` (per viewer; bump the version to force a fresh layout everywhere after a seed/physics change; best-effort — every storage access is guarded, corrupt/absurd entries are dropped, removed nodes pruned, positions shifted when the viewport centre changed). On (re)open, nodes with a remembered position keep it, newcomers are seeded next to their relatives (`seedFromKnown`), and the sim starts at alpha `LAYOUT_REFINE_ALPHA` + share of newcomers (capped at the 0.3 reheat); under 50% remembered → full layout.
- Tests/debug: `window.__stemmaChart.snapshot()` returns drawn nodes, ghosts, edges (with arrow kind) and per-frame stats; e2e helpers in `e2e/tests/_chart.ts`. Perf scripts: `e2e/bench/` (`renderBench.mjs`, `profileBench.mjs`, synthetic stemmas, mocked backend). Perf budgets run in CI: `cd e2e && npx playwright test -c perf.config.ts` (`e2e/perf/`, synthetic 200/750/3000-person stemmas, mocked backend, no Docker) checks idle frames/CPU, draw time while panning and hover cost against `BUDGETS` and fails on a regression; results land in `e2e/perf-results/`.
- Accessibility: the canvas is focusable — arrows move between people (`chartKeyboard.ts`), Enter opens, Escape stops; an aria-live region announces the focused person and a visually hidden list (`#chart-people`, out of the Tab order) exposes everyone to screen readers. The minimap is its own canvas (`drawMinimap`), and the menu exports PNG (`pngExport.ts`) as well as SVG.

## Edit-mode gestures

Edit-mode pointer handling on the chart canvas is `components/EditGestures.svelte`:

| Gesture | Outcome |
|---|---|
| drag a person or family | moves it — `FullStemma.placeNode` → `engine.moveTo` (position, pin and anchor, in the worker too), layout cache, pinned-people position; the focus is dropped while moving and set on the node again on drop, so its ghosts reappear where it now is |
| long press (≥ `TAP_MAX_MS`, any pointer) on a node | opens the card |
| click (mouse) on a node | opens the card (hover focuses) |
| short tap (touch) on a node / empty canvas | focus / blur |
| drag on empty canvas | pans (d3.zoom), as in view mode |
| **link mode** (`link-fab`): drag a person onto another | a line follows the pointer, valid targets light up; on drop `LinkPicker.svelte` offers the valid links (`ghostLink.ts` `linkOptions`: spouses, or one the other's child — in each of the parent's families that can take them, or a new family with that parent alone) → `MutationActions.linkPeople`. No ghosts in link mode |
| Escape | cancels a move (node goes back) and blurs; with nothing in progress it leaves link mode |

Outside link mode a drag only moves; ghosts add new relatives, link mode links people already in the tree.

### Pending families

- Ghost branches from a person (spouse, parent, child without an existing family) create a front-end-only `PendingFamily` (`pending-family-<uuid>`) merged into `displayedStemma` while `controller.createFamily` runs; it is promoted (`promotePendingFamily`) and cleared when the backend answers. Backend rejects single-member families (`IncompleteFamily`), so the family is only ever sent with both members.
- State lives in `pendingFamilies` in `App.svelte` and does not survive stemma switch / sign-out.

## Ghost affordances

Explicit "ghost" placeholders for adding spouses, parents, and children. Discoverability layer on top of the drag gestures.

### Concept

When a person or family is **focused**, dashed "ghost" nodes appear around it:

| Focused entity | Ghost(s)                                                         |
| -------------- | ---------------------------------------------------------------- |
| Person         | spouse-ghost (`addSpouse`) — always present                      |
| Person         | parent-ghost (`addParent`) — only if person has no parents       |
| Family         | child-ghost (`addChild`) — always present                        |

Clicking a ghost opens the create-person modal. On confirm, ghost materializes into a real person + family; focus stays on original node so user can add more.

### Focus model

- State: `focusedId: { kind: "person" | "family", id: string } | null`.
- **Desktop**: hovering bounding box sets focus (~150 ms debounce on leave to prevent flicker). Click on real node = edit modal.
- **Mobile**: short-tap (<500 ms) on real node = focus. Long-tap (≥500 ms) = edit modal (a long mouse press too). Tap elsewhere = blur. ESC blurs on desktop.

### Physics

- All non-focused real nodes frozen via `fx, fy = current`.
- Focused real node also frozen (anchored at tap position — no jump).
- Ghosts: pinned at their seeds close to the focus (`GHOST_FAMILY_GAP` / `GHOST_PERSON_GAP` / `GHOST_CHILD_DROP` in `ghostHelpers.ts`): spouse to the right, parent above, child below the family. The real nodes around make room for them instead (below); the burst simulation only drives that push. Sim stops on blur, ghosts despawn.
- Real nodes near the ghosts make room (`ghostPush.ts`): while the burst runs, nodes within `GHOST_PUSH_REACH` of a ghost (except the focused node and viewer-pinned people) are pushed off the ghost circles and their labels (`GHOST_PUSH_CLEARANCE`), off the dashed ghost edges, and real edges running through a ghost are shifted aside with their ends — with a spring back home, never closer to anyone than they were (up to `NODE_SEPARATION`). They move on the chart itself (their frozen burst copies follow, so ghosts collide with them where they are) and glide home on blur; a focus that starts mid-glide pushes from home (`PushRegistry`, one per chart via `pushRegistryFor`), and leaving edit mode settles everyone home before the layout runs. A node something else moved meanwhile (drag, layout) stays put. Not unfrozen in the burst sim: edit mode leaves the graph pinned out of equilibrium, so the full forces would make them drift with no ghost near.

### Visual

- Dashed border + ~0.6 opacity — same language as pending family.
- Dashed edge from focused node to ghost.
- Centered "+" icon + i18n label.
- Fade-in/out 200 ms on focus change.

## Person card

`PersonDetailsModal.svelte` is the one card for viewing, editing and creating a person, laid out as a centred profile: avatar (placeholder when there is no photo), name, other names, life years, then bio and attachments. Viewing shows only what is filled in — no empty bio or attachment blocks. Editing keeps the same order with fields; an empty bio is a "+ Bio" link until asked for. Dates are typed as a year, mm.yyyy or dd.mm.yyyy (`parseDateInput` still accepts the "c."/"~" approximate prefixes, but the UI does not ask for them).

## Known constraints

- `requestSanitizer.ts` drops fields with empty-string values. If a request type has a required field that may legitimately be empty (e.g. `name` for an "unknown" person), do not route it through the sanitizer or the backend rejects with `RequestDeserializationProblem`.
