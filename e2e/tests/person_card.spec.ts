import { expect, test } from "./_fixtures";
import { openPersonCard } from "./_open";
import { addOrphan, createFreshStemma, enterEditMode } from "./_edit";

test("the bio takes the room the card has left; pin and buttons stay in sight", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/");
  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Bio${Date.now()}`;
  await addOrphan(page, name);
  await openPersonCard(page, name);

  await page.getByTestId("person-add-bio").click();
  const bio = page.getByTestId("person-bio");
  await bio.fill(Array.from({ length: 80 }, (_, i) => `Line ${i + 1} of a long biography.`).join("\n"));

  const vp = page.viewportSize()!;
  const field = (await bio.boundingBox())!;
  // stretched over the free room (well beyond its 5 rows), but within the screen
  expect(field.height).toBeGreaterThan(300);
  expect(field.y + field.height).toBeLessThanOrEqual(vp.height);
  // a long text scrolls inside it instead of pushing the controls away
  const overflow = await bio.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(overflow).toBeGreaterThan(0);
  for (const id of ["person-save"]) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
  }
  const pin = (await page.locator("#person-pin").boundingBox())!;
  expect(pin.y + pin.height).toBeLessThanOrEqual(vp.height);
});
