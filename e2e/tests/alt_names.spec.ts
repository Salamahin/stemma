import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";

async function createFreshStemma(page: Page) {
  const stemmaBtn = page.getByTestId("chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 30_000 });
  await stemmaBtn.click();
  await page.getByTestId("chip-add-stemma").click();
  const modal = page.getByTestId("add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  const name = `alt-${Date.now()}`;
  await modal.locator("input").fill(name);
  await modal.locator("button.btn-primary").click();
  await expect(stemmaBtn).toContainText(name, { timeout: 15_000 });
}

test("a person is found by a maiden name", async ({ page }) => {
  await page.goto("/");
  await createFreshStemma(page);
  await page.getByTestId("edit-fab").click();
  await page.getByTestId("add-person-fab").click();

  const stamp = Date.now();
  const name = `Ivanova Maria ${stamp}`;
  await page.getByTestId("person-name-input").fill(name);
  await page.getByTestId("person-add-alt-name").click();
  await page.getByTestId("person-alt-name-input").fill(`Petrova${stamp}`);
  await page.getByTestId("person-create").click();

  // After a reload the alternative name comes back from the backend and search uses it.
  await page.reload();
  await page.getByTestId("search-input").fill(`Petrova${stamp}`);
  await expect(page.getByTestId("search-result").filter({ hasText: name })).toBeVisible({ timeout: 15_000 });
});
