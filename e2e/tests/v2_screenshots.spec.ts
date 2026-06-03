import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

async function waitForV2Ready(page: import("@playwright/test").Page) {
  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
}

test("v2 screenshots: populated canvas + person sheet + family stub sheet", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);
  await page.waitForTimeout(800);

  await page.screenshot({ path: "test-results/v2-01-landing-populated.png" });

  await page.getByTestId("v2-edit-fab").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-02-edit-mode-on.png" });

  const svg = page.locator("svg#chart");
  const personNode = svg.locator("g[id^='person_']").first();
  await expect(personNode).toBeVisible({ timeout: 15_000 });
  await personNode.dispatchEvent("click");

  const personSheet = page.getByTestId("v2-person-sheet");
  await expect(personSheet).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/v2-03-person-sheet-edit.png" });

  await page.getByTestId("v2-add-family-action").dispatchEvent("click");

  const familySheet = page.getByTestId("v2-family-sheet");
  await expect(familySheet).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/v2-04-family-stub-sheet.png" });

  await page.getByTestId("v2-add-child-action").dispatchEvent("click");
  await expect(familySheet.locator("#personName")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/v2-05-family-add-child-picker.png" });
});

test("v2 screenshots: bootstrap empty stemma → orphan → stub → real family", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  // Switch to the empty "My family tree" stemma via chip dropdown if present
  const stemmaChipBtn = page.locator(".stemma-btn");
  if (await stemmaChipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await stemmaChipBtn.click();
    await page.waitForTimeout(300);
    const emptyOption = page.getByRole("button", { name: /My family tree|Моя родословная/ }).first();
    if (await emptyOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await emptyOption.click();
      await page.waitForTimeout(1_500);
    }
  }

  // Empty + edit off (stemma may or may not be empty depending on previous test runs)
  await page.screenshot({ path: "test-results/v2-06-empty-state.png" });

  await page.getByTestId("v2-edit-fab").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-07-empty-edit-on.png" });

  // Open name modal via add-person FAB
  const addPersonFab = page.getByTestId("v2-add-person-fab");
  await expect(addPersonFab).toBeVisible({ timeout: 5_000 });
  await addPersonFab.click();

  const nameInput = page.getByTestId("v2-name-input");
  await expect(nameInput).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-08-name-modal.png" });

  await nameInput.fill("Anchor");
  await page.getByTestId("v2-name-confirm").click();

  // Wait for the new person to land on the canvas
  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible({ timeout: 15_000 });
  await expect(svg.locator("text").filter({ hasText: "Anchor" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/v2-09-anchor-created.png" });

  // Click anchor → +family stub
  await svg.locator("g[id^='person_']").first().dispatchEvent("click");
  const personSheet = page.getByTestId("v2-person-sheet");
  await expect(personSheet).toBeVisible();
  await page.getByTestId("v2-add-family-action").dispatchEvent("click");

  const familySheet = page.getByTestId("v2-family-sheet");
  await expect(familySheet).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/v2-10-stub-on-canvas.png" });

  // +child Junior
  await page.getByTestId("v2-add-child-action").dispatchEvent("click");
  const select = familySheet.locator(".svelte-select input").first();
  await expect(select).toBeVisible();
  await select.fill("Junior");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const confirmBtn = page.getByTestId("v2-family-confirm");
  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
  await confirmBtn.click();

  await expect(svg.locator("text").filter({ hasText: "Junior" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/v2-11-populated-real-family.png" });

  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/v2-12-populated-mobile.png" });
});
