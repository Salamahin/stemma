import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 800 };

async function waitForV2Ready(page: import("@playwright/test").Page) {
  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
}

async function openMenu(page: import("@playwright/test").Page) {
  await page.locator(".menu-btn").click();
}

async function clickBackdropCorner(page: import("@playwright/test").Page) {
  await page.mouse.click(10, 10);
}

async function ensureEditMode(page: import("@playwright/test").Page) {
  const addPersonFab = page.getByTestId("v2-add-person-fab");
  if (!(await addPersonFab.isVisible({ timeout: 500 }).catch(() => false))) {
    await page.getByTestId("v2-edit-fab").click();
    await expect(addPersonFab).toBeVisible({ timeout: 5_000 });
  }
}

async function openFirstPersonSheet(page: import("@playwright/test").Page) {
  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible({ timeout: 15_000 });
  const node = svg.locator("g[id^='person_']").first();
  await expect(node).toBeVisible({ timeout: 10_000 });
  await node.dispatchEvent("click");
  await expect(page.getByTestId("v2-person-sheet")).toBeVisible();
}

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize(info.title.includes("mobile") ? MOBILE : DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);
});

test("v2 about modal closes on backdrop click", async ({ page }) => {
  await openMenu(page);
  await page.getByTestId("v2-menu-about").click();
  const modal = page.getByTestId("v2-about-modal");
  await expect(modal).toBeVisible();
  await clickBackdropCorner(page);
  await expect(modal).toBeHidden();
});

test("v2 settings modal closes on backdrop click", async ({ page }) => {
  await openMenu(page);
  await page.getByTestId("v2-menu-settings").click();
  const modal = page.getByTestId("v2-settings-modal");
  await expect(modal).toBeVisible();
  await clickBackdropCorner(page);
  await expect(modal).toBeHidden();
});

test("v2 modal stays open on panel click", async ({ page }) => {
  await openMenu(page);
  await page.getByTestId("v2-menu-about").click();
  const modal = page.getByTestId("v2-about-modal");
  await expect(modal).toBeVisible();
  await modal.click({ position: { x: 20, y: 20 } });
  await expect(modal).toBeVisible();
});

test("v2 modal closes on Escape", async ({ page }) => {
  await openMenu(page);
  await page.getByTestId("v2-menu-settings").click();
  const modal = page.getByTestId("v2-settings-modal");
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
});

test("v2 rename stemma prompt modal closes on backdrop click", async ({ page }) => {
  await page.locator("[data-testid='v2-chip-stemma-btn']").click();
  await page.getByTestId("v2-chip-rename").first().click();
  const modal = page.getByTestId("v2-rename-stemma-modal");
  await expect(modal).toBeVisible();
  await clickBackdropCorner(page);
  await expect(modal).toBeHidden();
});

test("v2 remove stemma confirm modal closes on backdrop click", async ({ page }) => {
  await page.locator("[data-testid='v2-chip-stemma-btn']").click();
  const removeBtn = page.getByTestId("v2-chip-remove").first();
  if (!(await removeBtn.isVisible({ timeout: 1_500 }).catch(() => false))) {
    test.skip(true, "no removable stemma in seeded data");
    return;
  }
  await removeBtn.click();
  const modal = page.getByTestId("v2-remove-stemma-modal");
  await expect(modal).toBeVisible();
  await clickBackdropCorner(page);
  await expect(modal).toBeHidden();
});

test("v2 person sheet (desktop popover) closes on backdrop click", async ({ page }) => {
  await openFirstPersonSheet(page);
  await clickBackdropCorner(page);
  await expect(page.getByTestId("v2-person-sheet")).toBeHidden();
});

test("v2 person sheet on mobile closes on backdrop click", async ({ page }) => {
  await openFirstPersonSheet(page);
  await clickBackdropCorner(page);
  await expect(page.getByTestId("v2-person-sheet")).toBeHidden();
});

test("v2 share modal closes on backdrop click", async ({ page }) => {
  await ensureEditMode(page);
  await openFirstPersonSheet(page);
  const shareBtn = page.getByTestId("v2-share-action");
  if (!(await shareBtn.isVisible({ timeout: 1_500 }).catch(() => false))) {
    test.skip(true, "no share action visible for this person");
    return;
  }
  await shareBtn.click();
  const modal = page.getByTestId("v2-share-modal");
  await expect(modal).toBeVisible();
  await clickBackdropCorner(page);
  await expect(modal).toBeHidden();
});

test("v2 person details modal closes on backdrop click", async ({ page }) => {
  await ensureEditMode(page);
  await openFirstPersonSheet(page);
  const editPencil = page.locator("[data-testid='v2-person-sheet'] .bi-pencil").first();
  await editPencil.click();
  const modal = page.getByTestId("v2-person-details-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await clickBackdropCorner(page);
  await expect(modal).toBeHidden();
});

const PNG_1X1 = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63f8cf000000030001012e3ea6f80000000049454e44ae426082",
  "hex",
);

test("v2 person details modal cropping suppresses backdrop dismiss", async ({ page }) => {
  await ensureEditMode(page);
  await openFirstPersonSheet(page);
  const editPencil = page.locator("[data-testid='v2-person-sheet'] .bi-pencil").first();
  await editPencil.click();
  const modal = page.getByTestId("v2-person-details-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await page.locator("[data-testid='v2-person-details-modal'] input[type='file']").setInputFiles({
    name: "tiny.png",
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
  await expect(page.locator(".crop-area")).toBeVisible({ timeout: 5_000 });
  await clickBackdropCorner(page);
  await expect(modal).toBeVisible();
});
