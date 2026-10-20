import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";
import { waitForFirstLoginSeeded } from "./_seeded";
import { chartSnapshot } from "./_chart";

type Layout = { ends: number; lastEndAt: number; lastTickAt: number };

async function waitForSettledLayout(page: Page) {
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const l = (window as unknown as { __stemmaChart?: { layout(): Layout } }).__stemmaChart?.layout();
          return !!l && l.ends > 0 && l.lastEndAt >= l.lastTickAt && performance.now() - l.lastEndAt > 300;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);
}

async function positions(page: Page): Promise<Map<string, [number, number]>> {
  const snap = await chartSnapshot(page);
  return new Map(snap.nodes.map((n) => [n.id, [n.x, n.y] as [number, number]]));
}

test("a reopened stemma starts from its remembered layout", async ({ page }) => {
  // Lays out ~400 people from scratch; a busy CI runner needs more than the default 60s.
  test.slow();
  await page.goto("/");
  await waitForFirstLoginSeeded(page);
  await waitForSettledLayout(page);
  const before = await positions(page);
  expect(before.size).toBeGreaterThan(10);
  await page.waitForTimeout(1_000); // debounced save

  await page.reload();
  await expect.poll(async () => (await chartSnapshot(page)).nodes.length, { timeout: 30_000 }).toBe(before.size);
  // Straight away every node is (about) where it was left. The snapshot can
  // land a few refine ticks in, hence some slack — a fresh layout would put
  // nodes hundreds to thousands of units away from their previous spots.
  const first = await positions(page);
  const moved = [...before].map(([id, p]) => {
    const q = first.get(id)!;
    return Math.hypot(p[0] - q[0], p[1] - q[1]);
  });
  moved.sort((a, b) => a - b);
  expect(moved[Math.floor(moved.length / 2)]).toBeLessThan(40);
  expect(moved[moved.length - 1]).toBeLessThan(200);

  // …and the refine afterwards keeps it essentially in place.
  await waitForSettledLayout(page);
  const after = await positions(page);
  const drift = [...before].map(([id, p]) => Math.hypot(p[0] - after.get(id)![0], p[1] - after.get(id)![1]));
  drift.sort((a, b) => a - b);
  expect(drift[Math.floor(drift.length / 2)]).toBeLessThan(40);
});

test("a corrupt stored layout never breaks rendering", async ({ page }) => {
  // Lays out ~400 people from scratch; a busy CI runner needs more than the default 60s.
  test.slow();
  await page.goto("/");
  await waitForFirstLoginSeeded(page);
  await waitForSettledLayout(page);
  await page.waitForTimeout(1_000);
  const count = (await chartSnapshot(page)).nodes.length;

  const garbage = [
    "{not json",
    JSON.stringify({ items: [1, 2, 3] }),
    JSON.stringify({ items: { x: null }, center: "nope" }),
    JSON.stringify({ items: Object.fromEntries((await chartSnapshot(page)).nodes.map((n) => [n.id, { x: 1e300, y: "NaN", vx: {}, vy: [] }])) }),
  ];
  for (const payload of garbage) {
    await page.evaluate((p) => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (k.startsWith("nodeLayout.")) localStorage.setItem(k, p);
      }
    }, payload);
    await page.reload();
    await expect.poll(async () => (await chartSnapshot(page)).nodes.length, { timeout: 30_000 }).toBe(count);
    // A layout from scratch keeps the page busy; on a slow CI runner one snapshot alone took 14s.
    await expect.poll(async () => (await chartSnapshot(page)).stats.nodes, { timeout: 30_000 }).toBeGreaterThan(0);
    const snap = await chartSnapshot(page);
    expect(snap.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    await waitForSettledLayout(page);
  }
});
