import { expect, type Page } from "@playwright/test";

// The family graph is drawn on <canvas id="chart">. FullStemma exposes
// window.__stemmaChart.snapshot() — the renderer's own view of what it drew —
// which these helpers use in place of the old per-node SVG DOM.

export type ChartNode = {
  id: string;
  type: "person" | "family";
  name: string | null;
  x: number;
  y: number;
  r: number;
  drawn: boolean;
  pending: boolean;
  labelHidden: boolean;
  clientX: number;
  clientY: number;
};

export type ChartGhost = {
  id: string;
  type: "ghost-person" | "ghost-family";
  x: number;
  y: number;
  label: string | null;
  clientX: number;
  clientY: number;
  dying: boolean;
};

export type ChartEdge = { id: string; type: "familyToChild" | "spouseToFamily"; source: string; target: string; arrow: "person" | "family" };

export type ChartSnapshot = {
  nodes: ChartNode[];
  ghosts: ChartGhost[];
  edges: ChartEdge[];
  stats: { edges: number; arrows: number; nodes: number };
  /** How many times person labels were (re)placed — label layout runs when the layout rests. */
  labelLayouts: number;
};

export async function chartSnapshot(page: Page): Promise<ChartSnapshot> {
  return await page.evaluate(() => {
    const api = (window as unknown as { __stemmaChart?: { snapshot(): unknown } }).__stemmaChart;
    if (!api) return { nodes: [], ghosts: [], edges: [], stats: { edges: 0, arrows: 0, nodes: 0 }, labelLayouts: 0 };
    return api.snapshot();
  }) as ChartSnapshot;
}

/** Committed (non-pending) person node carrying `name`, or null. */
export async function findPerson(page: Page, name: string): Promise<ChartNode | null> {
  const snap = await chartSnapshot(page);
  return snap.nodes.find((n) => n.type === "person" && !n.pending && n.name === name) ?? null;
}

/** Waits until a committed person named `name` is drawn on screen, and returns it. */
export async function expectPersonVisible(page: Page, name: string, timeout = 15_000): Promise<ChartNode> {
  let found: ChartNode | null = null;
  await expect
    .poll(async () => {
      found = await findPerson(page, name);
      return found?.drawn ?? false;
    }, { timeout })
    .toBe(true);
  return found!;
}

/** Moves the real mouse onto the centre of a node's circle. */
export async function hoverNode(page: Page, id: string) {
  const snap = await chartSnapshot(page);
  const node = snap.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`no node ${id}`);
  await page.mouse.move(node.clientX, node.clientY);
}

export async function ghostPersons(page: Page): Promise<ChartGhost[]> {
  return (await chartSnapshot(page)).ghosts.filter((g) => g.type === "ghost-person");
}

export async function ghostFamilies(page: Page): Promise<ChartGhost[]> {
  return (await chartSnapshot(page)).ghosts.filter((g) => g.type === "ghost-family");
}

export async function ghostById(page: Page, id: string): Promise<ChartGhost | null> {
  return (await chartSnapshot(page)).ghosts.find((g) => g.id === id) ?? null;
}

export async function nodeById(page: Page, id: string): Promise<ChartNode | null> {
  return (await chartSnapshot(page)).nodes.find((n) => n.id === id) ?? null;
}
