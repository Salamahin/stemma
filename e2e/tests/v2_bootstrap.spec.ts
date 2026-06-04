import { expect, test } from "./_fixtures";

test("v2 ghost flow: orphan person → person ghost → stub family → family ghost → backend create", async ({ page }) => {
  await page.goto("/v2");

  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });

  // Switch away from populated stemmas to avoid cycle constraints when adding a child
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
  await expect(editFab).toBeVisible();

  const addPersonFab = page.getByTestId("v2-add-person-fab");
  await expect(addPersonFab).toBeVisible({ timeout: 5_000 });
  await addPersonFab.click();

  const ts = Date.now();
  const anchorName = `Bootstrap${ts}`;
  const childName = `Child${ts}`;

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

  await page.getByTestId("v2-anchor-as-parent").click();
  await expect(popover).toBeHidden();

  const stubFamily = svg.locator("g[id^='family_stub-']").first();
  await expect(stubFamily).toBeVisible({ timeout: 5_000 });
  const stubId = (await stubFamily.getAttribute("id"))!.replace("family_", "");

  const familyChildGhost = page.locator(`[data-testid='v2-family-ghost-child-${stubId}']`);
  await expect(familyChildGhost).toBeVisible({ timeout: 5_000 });
  await familyChildGhost.dispatchEvent("click");

  await expect(popover).toBeVisible();
  await expect(page.getByTestId("v2-family-ghost-popover")).toBeVisible();

  await page.locator("#personName").waitFor({ state: "visible" });
  const personNameSelect = page.locator(".svelte-select input").first();
  await expect(personNameSelect).toBeVisible({ timeout: 5_000 });
  await personNameSelect.fill(childName);
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const confirmBtn = page.getByTestId("v2-ghost-confirm");
  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
  await confirmBtn.click();

  await expect(svg.locator("text").filter({ hasText: childName })).toBeVisible({ timeout: 15_000 });
  await expect(svg.locator("g[id^='family_stub-']")).toHaveCount(0, { timeout: 5_000 });

  const realFamily = svg.locator("g[id^='family_']:not([id^='family_stub-'])").first();
  await expect(realFamily).toBeVisible({ timeout: 10_000 });
  const realFamilyId = (await realFamily.getAttribute("id"))!.replace("family_", "");

  await expect(page.locator(`[data-testid='v2-family-ghost-parent-${realFamilyId}']`)).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(`[data-testid='v2-family-ghost-child-${realFamilyId}']`)).toBeVisible({ timeout: 5_000 });

  const familyParentGhost = page.locator(`[data-testid='v2-family-ghost-parent-${realFamilyId}']`);
  await familyParentGhost.dispatchEvent("click");
  await expect(popover).toBeVisible();
  await expect(page.getByTestId("v2-family-ghost-popover")).toBeVisible();
  const secondParentName = `Spouse${ts}`;
  await page.locator("#personName").waitFor({ state: "visible" });
  const parentSelect = page.locator(".svelte-select input").first();
  await parentSelect.fill(secondParentName);
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.getByTestId("v2-ghost-confirm").click();

  await expect(svg.locator("text").filter({ hasText: secondParentName })).toBeVisible({ timeout: 15_000 });
  // "+ parent" ghost is gated on parents.length < 2
  await expect(page.locator(`[data-testid='v2-family-ghost-parent-${realFamilyId}']`)).toHaveCount(0, { timeout: 5_000 });
});
