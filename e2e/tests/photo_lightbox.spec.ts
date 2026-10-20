import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./_fixtures";
import type { Page, Route } from "@playwright/test";
import { expectPersonVisible } from "./_chart";

const PHOTO_URL = "http://127.0.0.1:4173/e2e-photo/sample.jpg";
const PHOTO = readFileSync(path.join(__dirname, "fixtures", "sample_photo.jpg"));

async function createFreshStemma(page: Page) {
  const stemmaBtn = page.getByTestId("chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 30_000 });
  await stemmaBtn.click();
  await page.getByTestId("chip-add-stemma").click();
  const modal = page.getByTestId("add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await modal.locator("input").fill(`photo-${Date.now()}`);
  await modal.locator("button.btn-primary").click();
  await expect(stemmaBtn).toContainText("photo-", { timeout: 15_000 });
}

/** The local stack has no photo bucket: hand the person a photo in every API response instead. */
function withPhoto(name: string) {
  return async (route: Route) => {
    const response = await route.fetch();
    const body = JSON.stringify(await response.json(), (_key, value) =>
      value && value.type === "PersonDescription" && value.name === name ? { ...value, photoUrl: PHOTO_URL } : value,
    );
    await route.fulfill({ response, body });
  };
}

test("in view mode a click on the avatar shows the photo full size", async ({ page }) => {
  const name = `Photographed${Date.now()}`;
  await page.route("**/e2e-photo/**", (route) => route.fulfill({ contentType: "image/jpeg", body: PHOTO }));
  await page.route("**/stemma", withPhoto(name));

  await page.goto("/");
  await createFreshStemma(page);
  await page.getByTestId("edit-fab").click();
  await page.getByTestId("add-person-fab").click();
  await page.getByTestId("person-name-input").fill(name);
  await page.getByTestId("person-create").click();
  await page.getByTestId("edit-fab").click();
  await expect(page.locator(".edit-mode")).toHaveCount(0);

  await page.reload();
  const node = await expectPersonVisible(page, name);
  await page.mouse.click(node.clientX, node.clientY);
  await expect(page.getByTestId("person-view-name")).toHaveText(name, { timeout: 5_000 });

  await page.getByTestId("person-photo-open").click();
  const lightbox = page.getByTestId("person-photo-lightbox");
  await expect(lightbox).toBeVisible();
  const image = lightbox.locator("img");
  await expect(image).toHaveAttribute("src", PHOTO_URL);
  const box = await image.boundingBox();
  expect(box!.width).toBeGreaterThan(300);

  // Escape closes the photo, not the card under it.
  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
  await expect(page.getByTestId("person-view-name")).toBeVisible();

  // So does a click anywhere on it.
  await page.getByTestId("person-photo-open").click();
  await lightbox.click();
  await expect(lightbox).toHaveCount(0);
  await expect(page.getByTestId("person-view-name")).toBeVisible();
});

test("a click on an empty spot of the chart closes a person card", async ({ page }) => {
  const name = `Lonely${Date.now()}`;
  await page.goto("/");
  await createFreshStemma(page);
  await page.getByTestId("edit-fab").click();
  await page.getByTestId("add-person-fab").click();
  await page.getByTestId("person-name-input").fill(name);
  await page.getByTestId("person-birth").fill("1899");
  await page.getByTestId("person-create").click();
  await page.getByTestId("edit-fab").click();
  await expect(page.locator(".edit-mode")).toHaveCount(0);

  const node = await expectPersonVisible(page, name);
  await page.mouse.click(node.clientX, node.clientY);
  await expect(page.getByTestId("person-view-name")).toHaveText(name, { timeout: 5_000 });
  // a lone birth date must not read as a death date
  await expect(page.locator(".view-dates")).toHaveText("1899 – ?");

  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width - 20, viewport.height / 2);
  await expect(page.getByTestId("person-view-name")).toHaveCount(0);
});

test("a date error does not push the other date field out of line", async ({ page }) => {
  await page.goto("/");
  await createFreshStemma(page);
  await page.getByTestId("edit-fab").click();
  await page.getByTestId("add-person-fab").click();
  await page.getByTestId("person-birth").fill("01.011929");
  await expect(page.getByTestId("person-date-error")).toBeVisible();

  const birth = await page.getByTestId("person-birth").boundingBox();
  const death = await page.getByTestId("person-death").boundingBox();
  expect(Math.abs(birth!.y - death!.y)).toBeLessThan(1);
});
