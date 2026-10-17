import { expect, test } from "./_fixtures";
import { waitForFirstLoginSeeded } from "./_seeded";
import { chartSnapshot } from "./_chart";

test("relationship arrows are rendered on a populated stemma", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);

  const canvas = page.locator("canvas#chart");
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => (await chartSnapshot(page)).edges.length, { timeout: 30_000 })
    .toBeGreaterThan(0);

  // Wait for a frame that actually drew relationship lines.
  await expect
    .poll(async () => (await chartSnapshot(page)).stats.edges, { timeout: 10_000 })
    .toBeGreaterThan(0);
  const snap = await chartSnapshot(page);

  // Both arrowhead kinds exist: parent → family and family → child.
  expect(snap.edges.filter((e) => e.arrow === "family").length).toBeGreaterThan(0);
  expect(snap.edges.filter((e) => e.arrow === "person").length).toBeGreaterThan(0);

  // Every relationship carries the arrowhead matching its direction…
  const wrongArrow = snap.edges.filter(
    (e) => e.arrow !== (e.type === "familyToChild" ? "person" : "family"),
  );
  expect(wrongArrow).toEqual([]);

  // …and every line drawn in the last frame had its arrowhead drawn with it.
  expect(snap.stats.arrows).toBe(snap.stats.edges);
});
