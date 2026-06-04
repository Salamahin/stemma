import { expect, test } from "@playwright/test";

test("v2 bootstrap: orphan person → stub family → child creates real family", async ({ page }) => {
  await page.goto("/v2");

  // Wait for auth + initial load
  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  // Wait for stemma to finish loading (canvas or empty state)
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });

  // Switch to the "My family tree" stemma to avoid populated stemmas with cycle constraints
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

  // Toggle edit mode on
  await editFab.click();
  await expect(editFab).toBeVisible();

  // Add-person FAB should now appear
  const addPersonFab = page.getByTestId("v2-add-person-fab");
  await expect(addPersonFab).toBeVisible({ timeout: 5_000 });
  await addPersonFab.click();

  // V2NameModal should appear — type name and confirm
  const ts = Date.now();
  const anchorName = `Bootstrap${ts}`;
  const childName = `Child${ts}`;

  const nameInput = page.getByTestId("v2-name-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(anchorName);
  await page.getByTestId("v2-name-confirm").click();

  // Wait for person node to appear in the SVG
  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible({ timeout: 15_000 });
  await expect(svg.locator("text").filter({ hasText: anchorName })).toBeVisible({ timeout: 15_000 });

  // Click the anchor person node to open person sheet (dispatchEvent bypasses stability check for animated SVG)
  await svg.locator("g[id^='person_']").filter({ has: page.locator(`text="${anchorName}"`) }).first().dispatchEvent("click");

  const personSheet = page.getByTestId("v2-person-details-modal");
  await expect(personSheet).toBeVisible();

  // Click + family
  const addFamilyBtn = page.getByTestId("v2-add-family-action");
  await expect(addFamilyBtn).toBeVisible();
  await addFamilyBtn.dispatchEvent("click");

  // Family sheet should open in stub mode
  const familySheet = page.getByTestId("v2-family-sheet");
  await expect(familySheet).toBeVisible();

  // Click + child
  const addChildBtn = page.getByTestId("v2-add-child-action");
  await expect(addChildBtn).toBeVisible();
  await addChildBtn.dispatchEvent("click");

  // Enter name for child via person picker
  await page.locator("#personName").waitFor({ state: "visible" });
  const personNameSelect = page.locator(".svelte-select input").first();
  await expect(personNameSelect).toBeVisible({ timeout: 5_000 });
  await personNameSelect.fill(childName);
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  // Confirm via the confirm button
  const confirmBtn = page.getByTestId("v2-family-confirm");
  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
  await confirmBtn.click();

  // Wait for real family + child node to appear
  await expect(svg.locator("text").filter({ hasText: childName })).toBeVisible({ timeout: 15_000 });

  // At least 1 family node should be present
  const familyNodes = svg.locator("g[id^='family_']");
  await expect(familyNodes.first()).toBeVisible({ timeout: 10_000 });
});
