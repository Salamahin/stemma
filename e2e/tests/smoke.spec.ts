import { expect, test } from "@playwright/test";

test("loads app with e2e auth bypass", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Stemma" })).toBeVisible();
  await expect(nav.getByText(/Family trees|Родословные/)).toBeVisible();
});
