import { expect, test } from "./_fixtures";
import type { Locator, Page } from "@playwright/test";

const TIP = {
  createFamily: /Create family|Создать семью/,
  createSpouse: /Create spouse|Создать супруга/,
  createChild: /Create child|Создать потомка/,
  attachSpouse: /Attach as spouse|Присоединить супруга/,
  attachChild: /Attach as child|Присоединить потомка/,
};

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
  // Wait for backend create + state settle
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

async function fillCreatePersonModal(page: Page, name: string) {
  const modal = page.getByTestId("v2-person-details-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("v2-person-name-input").fill(name);
  await page.getByTestId("v2-person-create").click();
}

async function buildFamilyByDraggingParentToEmpty(
  page: Page,
  parent: { cx: number; cy: number },
  childName: string,
) {
  await pressAndDrag(page, parent.cx, parent.cy, parent.cx + 280, parent.cy);
  await page.mouse.up();
  await fillCreatePersonModal(page, childName);
  await waitForRealFamily(page);
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

async function familyCenter(page: Page, index = 0): Promise<{ cx: number; cy: number }> {
  const family = page.locator("svg#chart g[id^='family_']").nth(index);
  await expect(family).toBeVisible({ timeout: 10_000 });
  const circle = family.locator("circle");
  const bb = await circle.boundingBox();
  if (!bb) throw new Error("no family bbox");
  return { cx: bb.x + bb.width / 2, cy: bb.y + bb.height / 2 };
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

async function pressAndDragFromFamily(
  page: Page,
  to: { cx: number; cy: number },
  index = 0,
) {
  const family = page.locator("svg#chart g[id^='family_']").nth(index);
  await expect(family).toBeVisible({ timeout: 10_000 });
  const bb = await family.locator("circle").boundingBox();
  if (!bb) throw new Error("no family bbox");
  const cx = bb.x + bb.width / 2;
  const cy = bb.y + bb.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy + 30, { steps: 4 });
  await page.mouse.move(to.cx, to.cy, { steps: 12 });
  await page.waitForTimeout(100);
}

async function waitForRealFamily(page: Page) {
  await expect(page.locator("svg#chart g[id^='family_pending-']")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator("svg#chart g[id^='family_']")).toHaveCount(1, { timeout: 15_000 });
}

async function expectTip(page: Page, re: RegExp) {
  const tip = page.getByTestId("v2-drag-tip");
  await expect(tip).toBeVisible({ timeout: 5_000 });
  await expect(tip).toHaveText(re);
}

test.describe.configure({ mode: "serial" });

test.describe("v2 drag tooltips", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2");
    await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
    await createFreshStemma(page);
    await enterEditMode(page);
  });

  test("person → empty tooltip: Create family", async ({ page }) => {
    const name = `Alice${Date.now()}`;
    await addOrphan(page, name);
    const alice = await nodeByText(page, name);
    await pressAndDrag(page, alice.cx, alice.cy, alice.cx + 260, alice.cy + 80);
    await expectTip(page, TIP.createFamily);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("person → family tooltip: Attach as spouse", async ({ page }) => {
    const ts = Date.now();
    const a = `Anna${ts}`;
    const b = `Boris${ts}`;
    const c = `AnnaChild${ts}`;
    await addOrphan(page, a);
    await addOrphan(page, b);
    const anna = await nodeByText(page, a);
    await buildFamilyByDraggingParentToEmpty(page, anna, c);
    const boris = await nodeByText(page, b);
    const fc = await familyCenter(page);
    await pressAndDrag(page, boris.cx, boris.cy, fc.cx, fc.cy);
    await expectTip(page, TIP.attachSpouse);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("family → person tooltip: Attach as child", async ({ page }) => {
    const ts = Date.now();
    const a = `Carl${ts}`;
    const c = `Eve${ts}`;
    const seed = `CarlChild${ts}`;
    await addOrphan(page, a);
    await addOrphan(page, c);
    const carl = await nodeByText(page, a);
    await buildFamilyByDraggingParentToEmpty(page, carl, seed);
    const eve = await nodeByText(page, c);
    await pressAndDragFromFamily(page, eve);
    await expectTip(page, TIP.attachChild);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("family → empty tooltip: Create child", async ({ page }) => {
    const ts = Date.now();
    const a = `Fred${ts}`;
    const seed = `FredChild${ts}`;
    await addOrphan(page, a);
    const fred = await nodeByText(page, a);
    await buildFamilyByDraggingParentToEmpty(page, fred, seed);
    const fc2 = await familyCenter(page);
    await pressAndDragFromFamily(page, { cx: fc2.cx + 250, cy: fc2.cy + 200 });
    await expectTip(page, TIP.createChild);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("empty → family tooltip: Create spouse", async ({ page }) => {
    const ts = Date.now();
    const a = `Henry${ts}`;
    const seed = `HenryChild${ts}`;
    await addOrphan(page, a);
    const henry = await nodeByText(page, a);
    await buildFamilyByDraggingParentToEmpty(page, henry, seed);
    const fc2 = await familyCenter(page);
    const vp = page.viewportSize();
    const startX = vp ? vp.width - 80 : fc2.cx + 300;
    const startY = vp ? Math.floor(vp.height / 2) : fc2.cy;
    await pressAndDrag(page, startX, startY, fc2.cx, fc2.cy);
    await expectTip(page, TIP.createSpouse);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("empty → person tooltip: Create family", async ({ page }) => {
    const name = `Jack${Date.now()}`;
    await addOrphan(page, name);
    const jack = await nodeByText(page, name);
    const startX = jack.cx + 280;
    const startY = jack.cy + 150;
    await pressAndDrag(page, startX, startY, jack.cx, jack.cy);
    await expectTip(page, TIP.createFamily);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
});

test("v2 family→empty release opens person details modal and creates child", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const ts = Date.now();
  const a = `Pat${ts}`;
  const seed = `PatChild${ts}`;
  const child = `Rita${ts}`;
  await addOrphan(page, a);
  const pat = await nodeByText(page, a);
  await buildFamilyByDraggingParentToEmpty(page, pat, seed);
  const fc2 = await familyCenter(page);
  await pressAndDragFromFamily(page, { cx: fc2.cx + 250, cy: fc2.cy + 200 });
  await page.mouse.up();
  await fillCreatePersonModal(page, child);
  const committed = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${child}"`) })
    .first();
  await expect(committed).toBeVisible({ timeout: 15_000 });
});

test("v2 empty→family release opens person details modal and creates spouse", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const ts = Date.now();
  const a = `Sam${ts}`;
  const seed = `SamChild${ts}`;
  const spouse = `Uma${ts}`;
  await addOrphan(page, a);
  const sam = await nodeByText(page, a);
  await buildFamilyByDraggingParentToEmpty(page, sam, seed);
  const fc2 = await familyCenter(page);
  const vp = page.viewportSize();
  const startX = vp ? vp.width - 80 : fc2.cx + 300;
  const startY = vp ? Math.floor(vp.height / 2) : fc2.cy;
  await pressAndDrag(page, startX, startY, fc2.cx, fc2.cy);
  await page.mouse.up();
  await fillCreatePersonModal(page, spouse);
  const committed = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${spouse}"`) })
    .first();
  await expect(committed).toBeVisible({ timeout: 15_000 });
});

test("v2 person→empty release opens person details modal and creates child", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Mira${Date.now()}`;
  const child = `MiraChild${Date.now()}`;
  await addOrphan(page, name);
  expect(await familyCount(page)).toBe(0);
  const mira = await nodeByText(page, name);
  await pressAndDrag(page, mira.cx, mira.cy, mira.cx + 260, mira.cy + 80);
  await page.mouse.up();
  await fillCreatePersonModal(page, child);
  await waitForRealFamily(page);
  const committed = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${child}"`) })
    .first();
  await expect(committed).toBeVisible({ timeout: 15_000 });
});

test("v2 empty→person release opens person details modal and creates parent", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Noel${Date.now()}`;
  const parent = `NoelParent${Date.now()}`;
  await addOrphan(page, name);
  expect(await familyCount(page)).toBe(0);
  const noel = await nodeByText(page, name);
  const startX = noel.cx + 280;
  const startY = noel.cy + 150;
  await pressAndDrag(page, startX, startY, noel.cx, noel.cy);
  await page.mouse.up();
  await fillCreatePersonModal(page, parent);
  await waitForRealFamily(page);
  const committed = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${parent}"`) })
    .first();
  await expect(committed).toBeVisible({ timeout: 15_000 });
});

test("v2 Esc cancels gesture before drop", async ({ page }) => {
  await page.goto("/v2");
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Nora${Date.now()}`;
  await addOrphan(page, name);
  const baselineFamilies = await familyCount(page);
  const nora = await nodeByText(page, name);
  await page.mouse.move(nora.cx, nora.cy);
  await page.mouse.down();
  await page.mouse.move(nora.cx + 60, nora.cy + 60, { steps: 6 });
  await expect(page.getByTestId("v2-drag-tip")).toBeVisible({ timeout: 3_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("v2-drag-tip")).toBeHidden({ timeout: 2_000 });
  await page.mouse.up();
  expect(await familyCount(page)).toBe(baselineFamilies);
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
