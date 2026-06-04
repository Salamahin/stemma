import { expect, test } from "@playwright/test";

test("v2 ghost flow: orphan → person ghost add-child → name input → backend create", async ({ page }) => {
  await page.goto("/v2");

  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });

  // Switch to an empty stemma to avoid cycle constraints.
  const stemmaBtn = page.locator(".stemma-btn");
  if (await stemmaBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await stemmaBtn.click();
    await page.waitForTimeout(300);
    const emptyOption = page.getByRole("button", { name: /My family tree|Моя родословная/ }).first();
    if (await emptyOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await emptyOption.click();
      await page.waitForTimeout(1_500);
    }
  }

  await editFab.click();

  const addPersonFab = page.getByTestId("v2-add-person-fab");
  await expect(addPersonFab).toBeVisible({ timeout: 5_000 });
  await addPersonFab.click();

  const ts = Date.now();
  const anchorName = `Bootstrap${ts}`;
  const childName = `Child${ts}`;
  const spouseName = `Spouse${ts}`;

  const nameInput = page.getByTestId("v2-name-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(anchorName);
  await page.getByTestId("v2-name-confirm").click();

  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible({ timeout: 15_000 });
  await expect(svg.locator("text").filter({ hasText: anchorName })).toBeVisible({ timeout: 15_000 });

  const anchorGroup = svg.locator("g[id^='person_']").filter({ has: page.locator(`text="${anchorName}"`) }).first();
  const anchorId = (await anchorGroup.getAttribute("id"))!.replace("person_", "");

  const personGhost = page.locator(`[data-testid='v2-person-ghost-${anchorId}']`);
  await expect(personGhost).toBeVisible({ timeout: 5_000 });
  await personGhost.dispatchEvent("click");

  const popover = page.getByTestId("v2-ghost-popover");
  await expect(popover).toBeVisible();
  await expect(page.getByTestId("v2-person-ghost-menu")).toBeVisible();

  await page.getByTestId("v2-person-ghost-add-child").click();
  const ghostNameInput = page.getByTestId("v2-person-ghost-name");
  await expect(ghostNameInput).toBeVisible();
  await ghostNameInput.fill(childName);
  await page.getByTestId("v2-person-ghost-confirm").click();

  await expect(svg.locator("text").filter({ hasText: childName })).toBeVisible({ timeout: 15_000 });

  const realFamily = svg.locator("g[id^='family_']").first();
  await expect(realFamily).toBeVisible({ timeout: 10_000 });
  const realFamilyId = (await realFamily.getAttribute("id"))!.replace("family_", "");

  const familyParentGhost = page.locator(`[data-testid='v2-family-ghost-parent-${realFamilyId}']`);
  await expect(familyParentGhost).toBeVisible({ timeout: 5_000 });
  await familyParentGhost.dispatchEvent("click");

  await expect(page.getByTestId("v2-family-ghost-popover")).toBeVisible();
  const familyNameInput = page.getByTestId("v2-family-ghost-name");
  await familyNameInput.fill(spouseName);
  await page.getByTestId("v2-ghost-confirm").click();

  await expect(svg.locator("text").filter({ hasText: spouseName })).toBeVisible({ timeout: 15_000 });
  // "+ parent" ghost is gated on parents.length < 2
  await expect(page.locator(`[data-testid='v2-family-ghost-parent-${realFamilyId}']`)).toHaveCount(0, { timeout: 5_000 });
});
