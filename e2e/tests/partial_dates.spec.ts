import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";

async function createFreshStemma(page: Page) {
  const stemmaBtn = page.getByTestId("chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 30_000 });
  await stemmaBtn.click();
  await page.getByTestId("chip-add-stemma").click();
  const modal = page.getByTestId("add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  const name = `dates-${Date.now()}`;
  await modal.locator("input").fill(name);
  await modal.locator("button.btn-primary").click();
  await expect(stemmaBtn).toContainText(name, { timeout: 15_000 });
}

test("a person can be saved with partial and approximate dates", async ({ page }) => {
  await page.goto("/");
  await createFreshStemma(page);
  await page.getByTestId("edit-fab").click();
  await page.getByTestId("add-person-fab").click();

  const name = `Partial${Date.now()}`;
  await page.getByTestId("person-name-input").fill(name);
  const birth = page.getByTestId("person-birth");
  const create = page.getByTestId("person-create");

  // A malformed date blocks saving…
  await birth.fill("13.1820");
  await expect(birth).toHaveClass(/is-invalid/);
  await expect(create).toBeDisabled();

  // …while year-only, month+year and "approximately" are fine.
  await birth.fill("ок. 1820");
  await page.getByTestId("person-death").fill("03.1890");
  await expect(birth).not.toHaveClass(/is-invalid/);
  await create.click();

  // The stored precision comes back from the backend: search shows the lifespan.
  await page.reload();
  await page.getByTestId("search-input").fill(name);
  const result = page.getByTestId("search-result").filter({ hasText: name });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result).toContainText("c. 1820 – Mar 1890");
});
