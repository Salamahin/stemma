import { expect, test } from "@playwright/test";

test("loads app with e2e auth bypass", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByText("Stemma")).toBeVisible();
  await expect(page.getByText(/Family trees|Родословные/)).toBeVisible();
});
