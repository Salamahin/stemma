import { expect, test } from "@playwright/test";

test("v2 search: find person, focus tree, handle no-match", async ({ page }) => {
  await page.goto("/v2");

  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });

  // Pick a stemma with at least one person. Default landing is a populated stemma.
  const svg = page.locator("svg#chart");
  if (!(await svg.isVisible({ timeout: 2_000 }).catch(() => false))) {
    // Add one person so search is populated.
    await editFab.click();
    await page.getByTestId("v2-add-person-fab").click();
    const nameInput = page.getByTestId("v2-name-input");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Searchable");
    await page.getByTestId("v2-name-confirm").click();
    await expect(svg).toBeVisible({ timeout: 15_000 });
    await expect(svg.locator("text").filter({ hasText: "Searchable" })).toBeVisible({ timeout: 15_000 });
  }

  const search = page.getByTestId("v2-search");
  await expect(search).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/v2-search-01-idle.png" });

  const input = page.getByTestId("v2-search-input");
  await expect(input).toBeVisible();

  // No-results state.
  await input.click();
  await input.fill("zzqx-unlikely-name");
  await expect(page.getByTestId("v2-search-no-results")).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/v2-search-02-no-results.png" });

  // Real person from canvas.
  await input.fill("");
  const firstPersonText = await svg.locator("g[id^='person_'] text").first().textContent();
  expect(firstPersonText).toBeTruthy();
  const fragment = (firstPersonText ?? "").trim().slice(0, 3);
  expect(fragment.length).toBeGreaterThanOrEqual(2);

  await input.fill(fragment);
  const dropdown = page.getByTestId("v2-search-dropdown");
  await expect(dropdown).toBeVisible();
  const result = page.getByTestId("v2-search-result").first();
  await expect(result).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/v2-search-03-results.png" });

  await result.click();

  await expect(dropdown).not.toBeVisible();
  await expect(input).toHaveValue("");
  await page.waitForTimeout(900);
  await page.screenshot({ path: "test-results/v2-search-04-after-zoom.png" });
});
