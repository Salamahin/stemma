import { expect, test } from "./_fixtures";
import { SEEDED_STEMMA_COUNT, waitForFirstLoginSeeded } from "./_seeded";

const NAMES = ["A", "A very long stemma name that should ellipsize quite far", "Middle"];

test("stemma dropdown buttons line up", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);

  for (const name of NAMES) {
    await page.locator("#navbarDropdownMenuLink").click();
    await page.locator(".dropdown-menu a.dropdown-item", { hasText: /Create new|Создать нов/ }).click();
    const modal = page.locator(".modal.show", { hasText: /Add new family tree|Добавить новую родословную/ });
    await expect(modal).toBeVisible();
    await modal.locator("#stemmaNameInput").fill(name);
    await modal.getByRole("button", { name: /^Add$|^Добавить$/ }).click();
    await expect(modal).toBeHidden();
  }

  await page.locator("#navbarDropdownMenuLink").click();
  const rows = page.locator(".dropdown-menu .stemma-row");
  await expect(rows).toHaveCount(NAMES.length + SEEDED_STEMMA_COUNT, { timeout: 30_000 });

  const renameRights: number[] = [];
  const lastRights: number[] = [];
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const actions = row.locator(".stemma-action");
    expect(await actions.count()).toBe(2);
    const renameBox = await actions.nth(0).boundingBox();
    const lastBox = await actions.nth(1).boundingBox();
    expect(renameBox).not.toBeNull();
    expect(lastBox).not.toBeNull();
    renameRights.push(Math.round(renameBox!.x + renameBox!.width));
    lastRights.push(Math.round(lastBox!.x + lastBox!.width));
  }

  console.log("rename right edges:", renameRights);
  console.log("last-button right edges:", lastRights);

  for (const r of renameRights) expect(Math.abs(r - renameRights[0])).toBeLessThanOrEqual(1);
  for (const r of lastRights) expect(Math.abs(r - lastRights[0])).toBeLessThanOrEqual(1);

  await page.screenshot({ path: "test-results/dropdown-en.png", fullPage: false });
});
