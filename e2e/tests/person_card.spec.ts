import { expect, test } from "./_fixtures";
import { openPersonCard } from "./_open";
import { addOrphan, createFreshStemma, enterEditMode } from "./_edit";

test("a long bio grows the field instead of scrolling inside it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Bio${Date.now()}`;
  await addOrphan(page, name);
  await openPersonCard(page, name);

  await page.getByTestId("person-add-bio").click();
  const bio = page.getByTestId("person-bio");
  await bio.fill(Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of a long biography.`).join("\n"));
  const box = await bio.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(box.scroll - box.client).toBeLessThanOrEqual(4);
  expect(box.client).toBeGreaterThan(400);
});
