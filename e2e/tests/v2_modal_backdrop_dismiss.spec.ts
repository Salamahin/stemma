import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const DESKTOP = { width: 1280, height: 800 };

async function waitForV2Ready(page: Page) {
  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
}

async function openMenu(page: Page) {
  await page.locator(".menu-btn").click();
}

async function clickBackdrop(page: Page) {
  // Top-left corner is always visible backdrop (modal panel is centered / bottom).
  await page.mouse.click(2, 2);
}

async function openFirstPersonModal(page: Page) {
  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible({ timeout: 15_000 });
  const node = svg.locator("g[id^='person_']").first();
  await expect(node).toBeVisible({ timeout: 10_000 });
  await node.dispatchEvent("click");
  await expect(page.getByTestId("v2-person-details-modal")).toBeVisible();
}

test("v2 about modal: backdrop click closes", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  await openMenu(page);
  await page.getByTestId("v2-menu-about").click();
  const modal = page.getByTestId("v2-about-modal");
  await expect(modal).toBeVisible();

  await clickBackdrop(page);
  await expect(modal).toBeHidden();
});

test("v2 settings modal: backdrop click closes", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  await openMenu(page);
  await page.getByTestId("v2-menu-settings").click();
  const modal = page.getByTestId("v2-settings-modal");
  await expect(modal).toBeVisible();

  await clickBackdrop(page);
  await expect(modal).toBeHidden();
});

test("v2 prompt modal (add stemma): backdrop click closes", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  await page.getByTestId("v2-chip-stemma-btn").click();
  await page.getByTestId("v2-chip-add-stemma").click();
  const modal = page.getByTestId("v2-add-stemma-modal");
  await expect(modal).toBeVisible();

  await clickBackdrop(page);
  await expect(modal).toBeHidden();
});

test("v2 confirm modal (remove stemma): backdrop click closes", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  // Need a removable stemma — create one first; the chip dropdown only renders Delete after the new
  // stemma is loaded as current, so wait for the chip button label to flip before opening it.
  const newName = `Backdrop${Date.now()}`;
  await page.getByTestId("v2-chip-stemma-btn").click();
  await page.getByTestId("v2-chip-add-stemma").click();
  const addModal = page.getByTestId("v2-add-stemma-modal");
  await expect(addModal).toBeVisible();
  await page.getByTestId("v2-prompt-input").fill(newName);
  await page.getByTestId("v2-prompt-confirm").click();
  await expect(addModal).toBeHidden();
  await expect(page.getByTestId("v2-chip-stemma-btn")).toContainText(newName, { timeout: 10_000 });

  await page.getByTestId("v2-chip-stemma-btn").click();
  const removeBtn = page.getByTestId("v2-chip-remove").first();
  await expect(removeBtn).toBeVisible({ timeout: 5_000 });
  await removeBtn.click();
  const modal = page.getByTestId("v2-remove-stemma-modal");
  await expect(modal).toBeVisible();

  await clickBackdrop(page);
  await expect(modal).toBeHidden();
});

test("v2 person details modal: backdrop click closes", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  await openFirstPersonModal(page);
  const modal = page.getByTestId("v2-person-details-modal");

  await clickBackdrop(page);
  await expect(modal).toBeHidden();
});

test("v2 family sheet: backdrop click closes", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible({ timeout: 15_000 });
  const familyNode = svg.locator("g[id^='family_']").first();
  if (!(await familyNode.isVisible({ timeout: 2_000 }).catch(() => false))) {
    test.skip(true, "no family nodes in any owned stemma to exercise the family sheet");
    return;
  }
  await familyNode.dispatchEvent("click");
  const sheet = page.getByTestId("v2-family-sheet");
  await expect(sheet).toBeVisible();

  await clickBackdrop(page);
  await expect(sheet).toBeHidden();
});

test("v2 modal: click inside panel does not close", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  await openMenu(page);
  await page.getByTestId("v2-menu-about").click();
  const modal = page.getByTestId("v2-about-modal");
  await expect(modal).toBeVisible();

  await modal.click();
  await expect(modal).toBeVisible();
});

test("v2 invite link modal: backdrop click closes", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  // Enter edit mode so the share area is rendered inside the person details modal.
  const editFab = page.getByTestId("v2-edit-fab");
  const editOn = await page.getByTestId("v2-add-person-fab").isVisible({ timeout: 500 }).catch(() => false);
  if (!editOn) {
    await editFab.click();
    await expect(page.getByTestId("v2-add-person-fab")).toBeVisible({ timeout: 5_000 });
  }

  await openFirstPersonModal(page);
  const personModal = page.getByTestId("v2-person-details-modal");
  const shareEmailInput = page.getByTestId("v2-share-email");
  if (!(await shareEmailInput.isVisible({ timeout: 1_500 }).catch(() => false))) {
    test.skip(true, "first person in test stack is read-only — no share UI available");
    return;
  }

  await shareEmailInput.fill("guest@example.com");
  await page.getByTestId("v2-share-generate").click();

  const linkModal = page.getByTestId("v2-invite-link-modal");
  await expect(linkModal).toBeVisible({ timeout: 10_000 });

  await clickBackdrop(page);
  await expect(linkModal).toBeHidden();
  // The person details modal is dismissed by V2App when the invite token arrives, so it should also be gone.
  await expect(personModal).toBeHidden();
});

test("v2 person details modal: cropping suppresses backdrop dismiss", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  // Enter edit mode so the photo upload button is rendered.
  const editFab = page.getByTestId("v2-edit-fab");
  const editOn = await page.getByTestId("v2-add-person-fab").isVisible({ timeout: 500 }).catch(() => false);
  if (!editOn) {
    await editFab.click();
    await expect(page.getByTestId("v2-add-person-fab")).toBeVisible({ timeout: 5_000 });
  }

  await openFirstPersonModal(page);
  const modal = page.getByTestId("v2-person-details-modal");

  // Smallest valid PNG (1x1 transparent).
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082",
    "hex",
  );
  const fileInput = modal.locator("input[type='file']");
  await fileInput.setInputFiles({ name: "tiny.png", mimeType: "image/png", buffer: png });

  await expect(modal.locator(".crop-area")).toBeVisible({ timeout: 5_000 });

  await clickBackdrop(page);
  await expect(modal).toBeVisible();
  await expect(modal.locator(".crop-area")).toBeVisible();
});

test("v2 modal: Escape key still closes", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto("/v2");
  await waitForV2Ready(page);

  await openMenu(page);
  await page.getByTestId("v2-menu-settings").click();
  const modal = page.getByTestId("v2-settings-modal");
  await expect(modal).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
});
