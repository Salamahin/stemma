import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

async function waitForV2Ready(page: import("@playwright/test").Page) {
  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
}

test("v2 screenshots: populated canvas + person sheet + family ghost popover", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);
  await page.waitForTimeout(800);

  await page.screenshot({ path: "test-results/v2-01-landing-populated.png" });

  await page.getByTestId("v2-edit-fab").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-02-edit-mode-on.png" });

  const addPersonFab = page.getByTestId("v2-add-person-fab");
  await expect(addPersonFab).toBeVisible({ timeout: 5_000 });
  await addPersonFab.click();
  const orphanName = `Orphan${Date.now()}`;
  const orphanInput = page.getByTestId("v2-name-input");
  await expect(orphanInput).toBeVisible();
  await orphanInput.fill(orphanName);
  await page.getByTestId("v2-name-confirm").click();

  const svg = page.locator("svg#chart");
  const orphanGroup = svg.locator("g[id^='person_']").filter({ has: page.locator(`text="${orphanName}"`) }).first();
  await expect(orphanGroup).toBeVisible({ timeout: 15_000 });
  const personId = (await orphanGroup.getAttribute("id"))!.replace("person_", "");

  const personGhost = page.locator(`[data-testid='v2-person-ghost-${personId}']`);
  await expect(personGhost).toBeVisible({ timeout: 5_000 });
  await personGhost.dispatchEvent("click");

  const popover = page.getByTestId("v2-ghost-popover");
  await expect(popover).toBeVisible();
  await expect(page.getByTestId("v2-person-ghost-menu")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-03-person-ghost-menu.png" });

  await page.getByTestId("v2-person-ghost-add-child").click();
  const personGhostName = page.getByTestId("v2-person-ghost-name");
  await expect(personGhostName).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-04-person-ghost-name-input.png" });

  await personGhostName.fill(`Kid${Date.now()}`);
  await page.getByTestId("v2-person-ghost-confirm").click();

  const realFamily = svg.locator("g[id^='family_']").first();
  await expect(realFamily).toBeVisible({ timeout: 10_000 });
  const realFamilyId = (await realFamily.getAttribute("id"))!.replace("family_", "");
  const familyChildGhost = page.locator(`[data-testid='v2-family-ghost-child-${realFamilyId}']`);
  await expect(familyChildGhost).toBeVisible({ timeout: 5_000 });
  await familyChildGhost.dispatchEvent("click");
  await expect(page.getByTestId("v2-family-ghost-popover")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-05-family-ghost-add-child.png" });
});

test("v2 screenshots: bootstrap empty stemma → ghost flow → real family", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

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

  await page.screenshot({ path: "test-results/v2-06-empty-state.png" });

  await page.getByTestId("v2-edit-fab").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-07-empty-edit-on.png" });

  const addPersonFab = page.getByTestId("v2-add-person-fab");
  await expect(addPersonFab).toBeVisible({ timeout: 5_000 });
  await addPersonFab.click();

  const nameInput = page.getByTestId("v2-name-input");
  await expect(nameInput).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-08-name-modal.png" });

  await nameInput.fill("Anchor");
  await page.getByTestId("v2-name-confirm").click();

  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible({ timeout: 15_000 });
  await expect(svg.locator("text").filter({ hasText: "Anchor" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/v2-09-anchor-created.png" });

  const anchorGroup = svg.locator("g[id^='person_']").filter({ has: page.locator(`text="Anchor"`) }).first();
  const anchorId = (await anchorGroup.getAttribute("id"))!.replace("person_", "");
  const personGhost = page.locator(`[data-testid='v2-person-ghost-${anchorId}']`);
  await expect(personGhost).toBeVisible({ timeout: 5_000 });
  await personGhost.dispatchEvent("click");

  await expect(page.getByTestId("v2-ghost-popover")).toBeVisible();
  await page.getByTestId("v2-person-ghost-add-child").click();

  const ghostNameInput = page.getByTestId("v2-person-ghost-name");
  await expect(ghostNameInput).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/v2-10-ghost-name-input.png" });

  await ghostNameInput.fill("Junior");
  await page.getByTestId("v2-person-ghost-confirm").click();

  await expect(svg.locator("text").filter({ hasText: "Junior" })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/v2-11-populated-real-family.png" });

  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/v2-12-populated-mobile.png" });
});
