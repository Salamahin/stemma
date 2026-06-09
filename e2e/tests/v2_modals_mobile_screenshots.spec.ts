import { test, expect } from "./_fixtures";

const MOBILE = { width: 390, height: 844 };

async function waitForV2Ready(page: import("@playwright/test").Page) {
  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
}

async function openMenu(page: import("@playwright/test").Page) {
  await page.locator(".menu-btn").click();
}

async function closeAnyModal(page: import("@playwright/test").Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function openFirstPersonSheet(page: import("@playwright/test").Page) {
  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible({ timeout: 15_000 });
  const node = svg.locator("g[id^='person_']").first();
  await expect(node).toBeVisible({ timeout: 10_000 });
  await node.dispatchEvent("click");
  await expect(page.getByTestId("v2-person-details-modal")).toBeVisible();
}

test("v2 modals screenshots (mobile)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(MOBILE);
  await page.goto("/v2");
  await waitForV2Ready(page);
  await page.waitForTimeout(600);

  // About
  await openMenu(page);
  await page.getByTestId("v2-menu-about").click();
  await expect(page.getByTestId("v2-about-modal")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/v2-mobile-m01-about.png" });
  await closeAnyModal(page);

  // Settings
  await openMenu(page);
  await page.getByTestId("v2-menu-settings").click();
  await expect(page.getByTestId("v2-settings-modal")).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/v2-mobile-m02-settings.png" });
  await closeAnyModal(page);

  // Stemma dropdown
  await page.locator("[data-testid='v2-chip-stemma-btn']").click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/v2-mobile-m03-stemma-dropdown.png" });

  // Rename stemma
  await page.getByTestId("v2-chip-rename").first().click();
  await expect(page.getByTestId("v2-rename-stemma-modal")).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/v2-mobile-m04-rename-stemma.png" });
  await closeAnyModal(page);

  // Clone stemma
  await page.locator("[data-testid='v2-chip-stemma-btn']").click();
  await page.waitForTimeout(200);
  await page.getByTestId("v2-chip-clone").first().click();
  await expect(page.getByTestId("v2-clone-stemma-modal")).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/v2-mobile-m05-clone-stemma.png" });
  await closeAnyModal(page);

  // Add new stemma
  await page.locator("[data-testid='v2-chip-stemma-btn']").click();
  await page.waitForTimeout(200);
  await page.getByTestId("v2-chip-add-stemma").click();
  await expect(page.getByTestId("v2-add-stemma-modal")).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: "test-results/v2-mobile-m06-add-stemma.png" });
  await closeAnyModal(page);

  // Remove (if possible)
  await page.locator("[data-testid='v2-chip-stemma-btn']").click();
  await page.waitForTimeout(200);
  const removeBtn = page.getByTestId("v2-chip-remove").first();
  if (await removeBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await removeBtn.click();
    await expect(page.getByTestId("v2-remove-stemma-modal")).toBeVisible();
    await page.waitForTimeout(200);
    await page.screenshot({ path: "test-results/v2-mobile-m07-remove-stemma.png" });
    await closeAnyModal(page);
  } else {
    await closeAnyModal(page);
  }

  // Person details modal (view mode)
  await openFirstPersonSheet(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-mobile-m08-person-details-view.png" });
  await closeAnyModal(page);

  // Enter edit mode
  const editFab = page.getByTestId("v2-edit-fab");
  const isEditOn = (await page.locator("[data-testid='v2-add-person-fab']").isVisible({ timeout: 500 }).catch(() => false));
  if (!isEditOn) {
    await editFab.click();
    await page.waitForTimeout(300);
  }

  // Person details modal (edit mode) — share access entry
  await openFirstPersonSheet(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-mobile-m09-person-details-share-empty.png" });

  const shareAccessBtn = page.getByTestId("v2-share-access-btn");
  if (await shareAccessBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await shareAccessBtn.click();
    const shareModal = page.getByTestId("v2-share-access-modal");
    await expect(shareModal).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "test-results/v2-mobile-m10-share-access-empty.png" });

    await page.getByTestId("v2-share-access-email").fill("guest@example.com");
    await page.waitForTimeout(200);
    await page.screenshot({ path: "test-results/v2-mobile-m11-share-access-filled.png" });
    await closeAnyModal(page);
  } else {
    await closeAnyModal(page);
  }

  // Family sheet with delete (edit mode)
  const svg = page.locator("svg#chart");
  const familyNode = svg.locator("g[id^='family_']").first();
  if (await familyNode.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await familyNode.dispatchEvent("click");
    const familySheet = page.getByTestId("v2-family-sheet");
    await expect(familySheet).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/v2-mobile-m14-family-card-edit.png" });
    const removeFamilyBtn = page.getByTestId("v2-remove-family-action");
    if (await removeFamilyBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await removeFamilyBtn.click();
      await expect(page.getByTestId("v2-remove-family-modal")).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: "test-results/v2-mobile-m15-family-remove-confirm.png" });
      await closeAnyModal(page);
    }
  }

  await openFirstPersonSheet(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/v2-mobile-m12-person-details.png" });

  // Toggle bio edit tab
  const editTab = page.locator("[data-testid='v2-person-details-modal'] .bio-tab", { hasText: /Edit|Редактировать/ }).first();
  if (await editTab.isVisible({ timeout: 500 }).catch(() => false)) {
    await editTab.click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: "test-results/v2-mobile-m13-person-details-bio-edit.png" });
  }

  // Person delete confirm
  const deleteBtn = page.getByTestId("v2-person-delete");
  if (await deleteBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await deleteBtn.click();
    const personRemoveModal = page.getByTestId("v2-remove-person-modal");
    await expect(personRemoveModal).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/v2-mobile-m16-person-remove-confirm.png" });
    await closeAnyModal(page);
  }
  await closeAnyModal(page);
});
