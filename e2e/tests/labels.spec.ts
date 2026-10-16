import { expect, test } from "./_fixtures";
import { waitForFirstLoginSeeded } from "./_seeded";
import { chartSnapshot } from "./_chart";

// #300: label placement used to hide any label that overlapped another one,
// so in dense families some people silently lost their names.
test("every person keeps a visible name label after the layout rests", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);

  await expect
    .poll(async () => (await chartSnapshot(page)).labelLayouts, { timeout: 30_000 })
    .toBeGreaterThan(0);
  const snap = await chartSnapshot(page);
  const people = snap.nodes.filter((n) => n.type === "person" && n.name);
  expect(people.length).toBeGreaterThan(10);
  expect(people.filter((n) => n.labelHidden).map((n) => n.name)).toEqual([]);
});
