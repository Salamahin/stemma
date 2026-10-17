import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";
import { openPersonCard } from "./_open";

async function createFreshStemma(page: Page) {
  const stemmaBtn = page.getByTestId("chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 30_000 });
  await stemmaBtn.click();
  await page.getByTestId("chip-add-stemma").click();
  const modal = page.getByTestId("add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  const name = `att-${Date.now()}`;
  await modal.locator("input").fill(name);
  await modal.locator("button.btn-primary").click();
  await expect(stemmaBtn).toContainText(name, { timeout: 15_000 });
}

test("a link attached to a person survives a reload and can be removed", async ({ page }) => {
  await page.goto("/");
  await createFreshStemma(page);
  await page.getByTestId("edit-fab").click();
  await page.getByTestId("add-person-fab").click();
  const name = `Attached${Date.now()}`;
  await page.getByTestId("person-name-input").fill(name);
  await page.getByTestId("person-create").click();

  await openPersonCard(page, name);
  await page.getByTestId("attachment-add-link").click();
  await page.getByTestId("attachment-url").fill("https://obd-memorial.ru/html/info.htm?id=1");
  await page.getByTestId("attachment-title").fill("ОБД Мемориал");
  await page.getByTestId("attachment-save").click();
  await expect(page.getByTestId("attachment-link")).toHaveText("ОБД Мемориал");

  await page.reload();
  await page.getByTestId("edit-fab").click();
  await openPersonCard(page, name);
  const link = page.getByTestId("attachment-link");
  await expect(link).toHaveText("ОБД Мемориал");
  await expect(link).toHaveAttribute("href", "https://obd-memorial.ru/html/info.htm?id=1");

  await page.getByTestId("attachment-remove").click();
  await expect(page.getByTestId("attachment")).toHaveCount(0);
});
