import { expect, test } from "./_fixtures";
import type { Locator, Page } from "@playwright/test";

async function createFreshStemma(page: Page) {
  const stemmaBtn = page.getByTestId("v2-chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 10_000 });
  await stemmaBtn.click();
  const addBtn = page.getByTestId("v2-chip-add-stemma");
  await expect(addBtn).toBeVisible({ timeout: 5_000 });
  await addBtn.click();
  const modal = page.getByTestId("v2-add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  const input = modal.locator("input");
  await input.fill(`drag-ux-${Date.now()}`);
  await modal.locator("button.btn-primary").click();
  await page.waitForTimeout(2_500);
}

async function enterEditMode(page: Page) {
  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await editFab.click();
  await expect(page.locator(".v2-edit-mode")).toHaveCount(1);
}

async function addOrphan(page: Page, name: string) {
  await page.getByTestId("v2-add-person-fab").click();
  const nameInput = page.getByTestId("v2-person-name-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByTestId("v2-person-create").click();
  const committed = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${name}"`) })
    .first();
  await expect(committed).toBeVisible({ timeout: 15_000 });
}

type NodeRef = { id: string; locator: Locator; cx: number; cy: number };

async function nodeByText(page: Page, text: string): Promise<NodeRef> {
  const svg = page.locator("svg#chart");
  const group = svg.locator("g[id^='person_']").filter({ has: page.locator(`text="${text}"`) }).first();
  await expect(group).toBeVisible({ timeout: 10_000 });
  const id = (await group.getAttribute("id"))!.replace("person_", "");
  const circle = group.locator("circle");
  const bb = await circle.boundingBox();
  if (!bb) throw new Error("no bbox for " + text);
  return { id, locator: group, cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 };
}

async function familyCount(page: Page): Promise<number> {
  return await page.locator("svg#chart g[id^='family_']").count();
}

async function pressAndDrag(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(fromX + 30, fromY + 30, { steps: 4 });
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.waitForTimeout(100);
}

test.describe.configure({ mode: "serial" });

async function expectNoOpDrag(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  const baselineFamilies = await familyCount(page);
  await pressAndDrag(page, startX, startY, endX, endY);
  const tip = page.getByTestId("v2-drag-tip");
  await expect(tip).toBeHidden({ timeout: 1_500 });
  await expect(page.locator("svg#chart .v2-drop-target")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByTestId("v2-person-details-modal")).toHaveCount(0);
  expect(await familyCount(page)).toBe(baselineFamilies);
}

test("v2 person → person drag is a no-op (no tip, no modal, no DB change)", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const ts = Date.now();
  const a = `Alpha${ts}`;
  const b = `Bravo${ts}`;
  await addOrphan(page, a);
  await addOrphan(page, b);
  const alpha = await nodeByText(page, a);
  const bravo = await nodeByText(page, b);
  await expectNoOpDrag(page, alpha.cx, alpha.cy, bravo.cx, bravo.cy);
});

test("v2 empty → empty drag is a no-op (no tip, no modal, no DB change)", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Solo${Date.now()}`;
  await addOrphan(page, name);
  const solo = await nodeByText(page, name);
  const startX = solo.cx + 320;
  const startY = solo.cy + 220;
  const endX = solo.cx - 320;
  const endY = solo.cy + 220;
  await expectNoOpDrag(page, startX, startY, endX, endY);
});

test("v2 person→empty release creates a pending family (silent, no modal)", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Mira${Date.now()}`;
  await addOrphan(page, name);
  expect(await familyCount(page)).toBe(0);
  const mira = await nodeByText(page, name);
  await pressAndDrag(page, mira.cx, mira.cy, mira.cx + 280, mira.cy + 80);
  await page.mouse.up();
  await expect(page.getByTestId("v2-person-details-modal")).toHaveCount(0);
  await expect(page.locator("svg#chart g[id^='family_pending-family-']")).toHaveCount(1, { timeout: 3_000 });
  expect(await familyCount(page)).toBe(1);
});

test("v2 empty→person release creates a pending family (silent, no modal)", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Noel${Date.now()}`;
  await addOrphan(page, name);
  expect(await familyCount(page)).toBe(0);
  const noel = await nodeByText(page, name);
  const startX = noel.cx + 280;
  const startY = noel.cy + 150;
  await pressAndDrag(page, startX, startY, noel.cx, noel.cy);
  await page.mouse.up();
  await expect(page.getByTestId("v2-person-details-modal")).toHaveCount(0);
  await expect(page.locator("svg#chart g[id^='family_pending-family-']")).toHaveCount(1, { timeout: 3_000 });
  expect(await familyCount(page)).toBe(1);
});

test("v2 dragging second person onto pending family promotes it to real family", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const ts = Date.now();
  const a = `Pia${ts}`;
  const b = `Quinn${ts}`;
  await addOrphan(page, a);
  await addOrphan(page, b);
  const pia = await nodeByText(page, a);
  await pressAndDrag(page, pia.cx, pia.cy, pia.cx + 280, pia.cy + 80);
  await page.mouse.up();
  const pendingFam = page.locator("svg#chart g[id^='family_pending-family-']").first();
  await expect(pendingFam).toBeVisible({ timeout: 3_000 });
  const pendingBb = await pendingFam.locator("circle").boundingBox();
  if (!pendingBb) throw new Error("no pending family bbox");
  const quinn = await nodeByText(page, b);
  await pressAndDrag(page, quinn.cx, quinn.cy, pendingBb.x + pendingBb.width / 2, pendingBb.y + pendingBb.height / 2);
  await page.mouse.up();
  await expect(page.locator("svg#chart g[id^='family_pending-family-']")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator("svg#chart g[id^='family_']:not([id*='pending-'])")).toHaveCount(1, { timeout: 10_000 });
});

test("v2 empty→person drag onto person that already has 2 parents is blocked", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const ts = Date.now();
  const dad = `Dad${ts}`;
  const mom = `Mom${ts}`;
  const kid = `Kid${ts}`;
  await addOrphan(page, dad);
  await addOrphan(page, mom);
  await addOrphan(page, kid);
  const dadNode = await nodeByText(page, dad);
  await pressAndDrag(page, dadNode.cx, dadNode.cy, dadNode.cx + 260, dadNode.cy + 80);
  await page.mouse.up();
  const pending = page.locator("svg#chart g[id^='family_pending-family-']").first();
  await expect(pending).toBeVisible({ timeout: 3_000 });
  const pendingBb = await pending.locator("circle").boundingBox();
  if (!pendingBb) throw new Error("no pending family bbox");
  const momNode = await nodeByText(page, mom);
  await pressAndDrag(page, momNode.cx, momNode.cy, pendingBb.x + pendingBb.width / 2, pendingBb.y + pendingBb.height / 2);
  await page.mouse.up();
  const realFam = page.locator("svg#chart g[id^='family_']:not([id*='pending-'])").first();
  await expect(realFam).toBeVisible({ timeout: 10_000 });
  const realBb = await realFam.locator("circle").boundingBox();
  if (!realBb) throw new Error("no real family bbox");
  const kidNode = await nodeByText(page, kid);
  await pressAndDrag(page, realBb.x + realBb.width / 2, realBb.y + realBb.height / 2, kidNode.cx, kidNode.cy);
  await page.mouse.up();
  await page.waitForTimeout(1_000);
  const familiesBefore = await familyCount(page);
  const kidNode2 = await nodeByText(page, kid);
  const startX = kidNode2.cx + 220;
  const startY = kidNode2.cy + 140;
  await pressAndDrag(page, startX, startY, kidNode2.cx, kidNode2.cy);
  const tip = page.getByTestId("v2-drag-tip");
  await expect(tip).toBeHidden({ timeout: 1_500 });
  await expect(page.locator("svg#chart .v2-drop-target")).toHaveCount(0);
  await page.mouse.up();
  expect(await familyCount(page)).toBe(familiesBefore);
});

test("v2 drag link line renders arrow marker at cursor end", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Olive${Date.now()}`;
  await addOrphan(page, name);
  const olive = await nodeByText(page, name);
  await pressAndDrag(page, olive.cx, olive.cy, olive.cx + 220, olive.cy + 120);
  const line = page.locator("svg#chart line.v2-link-line");
  await expect(line).toHaveCount(1, { timeout: 3_000 });
  await expect(line).toHaveAttribute("marker-end", "url(#v2-arrow)");
  await expect(page.locator("svg#chart defs marker#v2-arrow")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
});
