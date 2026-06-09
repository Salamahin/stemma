import { expect, test } from "./_fixtures";

test("loads app with e2e auth bypass", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("edit-fab")).toBeVisible();
});
