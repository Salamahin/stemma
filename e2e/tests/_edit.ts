import { expect, type Page } from "@playwright/test";
import { chartSnapshot, ghostById, expectPersonVisible } from "./_chart";

export async function createFreshStemma(page: Page) {
  const stemmaBtn = page.getByTestId("chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 10_000 });
  await stemmaBtn.click();
  const addBtn = page.getByTestId("chip-add-stemma");
  await expect(addBtn).toBeVisible({ timeout: 5_000 });
  await addBtn.click();
  const modal = page.getByTestId("add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await modal.locator("input").fill(`smoke-${Date.now()}`);
  await modal.locator("button.btn-primary").click();
  await page.waitForTimeout(2_500);
}

export async function enterEditMode(page: Page) {
  await page.getByTestId("edit-fab").click();
  await expect(page.locator(".edit-mode")).toHaveCount(1);
}

export async function leaveEditMode(page: Page) {
  await page.getByTestId("edit-fab").click();
  await expect(page.locator(".edit-mode")).toHaveCount(0);
}

export async function addOrphan(page: Page, name: string) {
  await page.getByTestId("add-person-fab").click();
  const nameInput = page.getByTestId("person-name-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByTestId("person-create").click();
  await expectPersonVisible(page, name, 15_000);
}

/** Clicks a ghost of the focused node once its burst has settled. */
export async function clickGhost(page: Page, ghostId: string) {
  await expect.poll(async () => !!(await ghostById(page, ghostId)), { timeout: 5_000 }).toBe(true);
  await page.waitForTimeout(900);
  const g = (await ghostById(page, ghostId))!;
  await page.mouse.move(g.clientX, g.clientY, { steps: 4 });
  await page.mouse.click(g.clientX, g.clientY);
}

export const nodeByName = async (page: Page, name: string) => (await chartSnapshot(page)).nodes.find((n) => n.name === name) ?? null;
