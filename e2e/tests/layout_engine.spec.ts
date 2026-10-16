import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";
import { waitForFirstLoginSeeded } from "./_seeded";
import { chartSnapshot } from "./_chart";

type Layout = { ends: number; lastEndAt: number; lastTickAt: number; engine: string | null; running: boolean };

const layout = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stemmaChart: { layout(): Layout } }).__stemmaChart.layout());

async function waitForIdleLayout(page: Page) {
  await expect
    .poll(async () => {
      const l = await layout(page);
      return l.ends > 0 && !l.running;
    }, { timeout: 30_000 })
    .toBe(true);
}

test("the force layout runs in a Web Worker and comes to rest", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);
  await waitForIdleLayout(page);
  expect((await layout(page)).engine).toBe("worker");
});

test("dragging a node in view mode moves it with the pointer and the layout settles afterwards", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);
  await waitForIdleLayout(page);

  const snap = await chartSnapshot(page);
  const k = (snap as unknown as { transform: { k: number } }).transform.k;
  const person = snap.nodes.find(
    (n) => n.type === "person" && n.drawn && n.clientX > 200 && n.clientX < 1000 && n.clientY > 200 && n.clientY < 500,
  );
  expect(person).toBeDefined();
  const endsBefore = (await layout(page)).ends;

  await page.mouse.move(person!.clientX, person!.clientY);
  await page.mouse.down();
  await page.mouse.move(person!.clientX + 60, person!.clientY + 40, { steps: 6 });
  await page.mouse.move(person!.clientX + 120, person!.clientY + 80, { steps: 6 });
  await page.waitForTimeout(150);

  // While held, the node sits under the pointer (main-thread authoritative)…
  const held = (await chartSnapshot(page)).nodes.find((n) => n.id === person!.id)!;
  expect(Math.abs(held.x - (person!.x + 120 / k))).toBeLessThan(2);
  expect(Math.abs(held.y - (person!.y + 80 / k))).toBeLessThan(2);
  // …and the worker keeps the layout live around it.
  expect((await layout(page)).running).toBe(true);

  await page.mouse.up();
  await expect.poll(async () => (await layout(page)).ends, { timeout: 15_000 }).toBeGreaterThan(endsBefore);
  await waitForIdleLayout(page);
});
