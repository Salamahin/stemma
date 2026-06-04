import { test, expect } from "./_fixtures";

const SAMPLE_PHOTO = "tests/fixtures/sample_photo.jpg";

async function waitForChartReady(page: import("@playwright/test").Page) {
  await expect(page.locator("#navbarDropdownMenuLink")).toBeVisible();
  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible();
  await expect(svg.locator("g.main > g")).not.toHaveCount(0, { timeout: 30_000 });
  return svg;
}

test("person details modal screenshots — desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const svg = await waitForChartReady(page);

  const personNode = svg.locator("g.main > g").filter({ has: page.locator("text") }).first();
  await expect(personNode).toBeVisible();
  await personNode.dispatchEvent("click");

  const modal = page.locator(".modal.show#personDetailsModal");
  await expect(modal).toBeVisible();
  await page.waitForTimeout(400);

  await modal.screenshot({ path: "test-results/person-modal-desktop.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await modal.screenshot({ path: "test-results/person-modal-mobile.png" });
});

test("photo cropper screenshot — desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const svg = await waitForChartReady(page);

  const personNode = svg.locator("g.main > g").filter({ has: page.locator("text") }).first();
  await personNode.dispatchEvent("click");

  const modal = page.locator(".modal.show#personDetailsModal");
  await expect(modal).toBeVisible();

  const fileInput = modal.locator('input[type="file"]');
  await fileInput.setInputFiles(SAMPLE_PHOTO);

  const cropArea = modal.locator(".person-photo-crop-area");
  await expect(cropArea).toBeVisible();
  await expect(modal.locator(".person-photo-crop-image")).toBeVisible();
  await page.waitForTimeout(500);

  await modal.screenshot({ path: "test-results/person-modal-crop-desktop.png" });

  const box = await cropArea.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy - 30, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  const zoomSlider = modal.locator('input[type="range"]');
  await zoomSlider.fill("2");
  await page.waitForTimeout(300);

  await modal.screenshot({ path: "test-results/person-modal-crop-desktop-zoomed.png" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await modal.screenshot({ path: "test-results/person-modal-crop-mobile.png" });
});
