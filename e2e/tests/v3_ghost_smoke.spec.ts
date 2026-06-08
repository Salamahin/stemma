import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";

async function createFreshStemma(page: Page) {
  const stemmaBtn = page.getByTestId("v3-chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 10_000 });
  await stemmaBtn.click();
  const addBtn = page.getByTestId("v3-chip-add-stemma");
  await expect(addBtn).toBeVisible({ timeout: 5_000 });
  await addBtn.click();
  const modal = page.getByTestId("v3-add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await modal.locator("input").fill(`v3-smoke-${Date.now()}`);
  await modal.locator("button.btn-primary").click();
  await page.waitForTimeout(2_500);
}

async function enterEditMode(page: Page) {
  await page.getByTestId("v3-edit-fab").click();
  await expect(page.locator(".v3-edit-mode")).toHaveCount(1);
}

async function leaveEditMode(page: Page) {
  await page.getByTestId("v3-edit-fab").click();
  await expect(page.locator(".v3-edit-mode")).toHaveCount(0);
}

async function addOrphan(page: Page, name: string) {
  await page.getByTestId("v3-add-person-fab").click();
  const nameInput = page.getByTestId("v3-person-name-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByTestId("v3-person-create").click();
  const committed = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${name}"`) })
    .first();
  await expect(committed).toBeVisible({ timeout: 15_000 });
}

test("/v3 route loads with v3 chrome", async ({ page }) => {
  await page.goto("/v3");
  await expect(page.getByTestId("v3-chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
});

test("v3 hover in edit mode reveals ghost nodes; moving away clears them", async ({ page }) => {
  await page.goto("/v3");
  await expect(page.getByTestId("v3-chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Hovered${Date.now()}`;
  await addOrphan(page, name);
  await page.waitForTimeout(500);

  const group = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${name}"`) })
    .first();

  // Hover over the circle directly so the mousemove fires on the SVG and
  // the distance-based hit detection can focus the node.
  const circle = group.locator("circle").first();
  await circle.hover({ force: true });
  await page.waitForTimeout(400);

  // An orphan person has no parent family, so three ghost branches render:
  // spouse, parent, child → 3 ghost person nodes (g.v3-ghost) plus ghost
  // family nodes (g.v3-ghost-family).  Assert on ghost persons only.
  const ghosts = page.locator("svg#chart g.v3-ghost");
  await expect(ghosts).toHaveCount(3, { timeout: 5_000 });

  // Move pointer away from any node to trigger blur.
  await page.mouse.move(5, 5);
  await expect(ghosts).toHaveCount(0, { timeout: 3_000 });
});

test("v3 orphan ghost layout: shared east family for spouse+child, parent family above", async ({ page }) => {
  await page.goto("/v3");
  await expect(page.getByTestId("v3-chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Layout${Date.now()}`;
  await addOrphan(page, name);
  await page.waitForTimeout(500);

  const group = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${name}"`) })
    .first();
  const circle = group.locator("circle").first();
  await circle.hover({ force: true });
  await page.waitForTimeout(400);

  // Exactly two ghost family nodes: one shared east, one parent.
  const families = page.locator("svg#chart g.v3-ghost-family");
  await expect(families).toHaveCount(2, { timeout: 5_000 });
  await expect(page.locator("svg#chart #ghost-family-east")).toHaveCount(1);
  await expect(page.locator("svg#chart #ghost-family-parent")).toHaveCount(1);

  // Three ghost persons: spouse, child, parent.
  await expect(page.locator("svg#chart #ghost-person-spouse")).toHaveCount(1);
  await expect(page.locator("svg#chart #ghost-person-child")).toHaveCount(1);
  await expect(page.locator("svg#chart #ghost-person-parent")).toHaveCount(1);

  const readTranslate = async (id: string) =>
    await page.locator(`svg#chart [id="${id}"]`).evaluate((el) => {
      const t = el.getAttribute("transform") ?? "";
      const m = t.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
    });

  const focusId = await group.evaluate((el) => el.getAttribute("id"));
  const focusPos = await readTranslate(focusId!);
  const eastFam = await readTranslate("ghost-family-east");
  const spouse = await readTranslate("ghost-person-spouse");
  const child = await readTranslate("ghost-person-child");
  const parentFam = await readTranslate("ghost-family-parent");
  const parent = await readTranslate("ghost-person-parent");

  expect(focusPos && eastFam && spouse && child && parentFam && parent).toBeTruthy();

  // East family east of focused; spouse east of east family; child below east family.
  expect(eastFam!.x).toBeGreaterThan(focusPos!.x);
  expect(spouse!.x).toBeGreaterThan(eastFam!.x);
  expect(Math.abs(spouse!.y - focusPos!.y)).toBeLessThan(5);
  expect(child!.y).toBeGreaterThan(eastFam!.y);

  // Parent family above focused; parent ghost above parent family.
  expect(parentFam!.y).toBeLessThan(focusPos!.y);
  expect(parent!.y).toBeLessThan(parentFam!.y);
});

test("v3 ghost-child stays separated from an existing real child", async ({ page }) => {
  await page.goto("/v3");
  await expect(page.getByTestId("v3-chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);

  const parentName = `Parent${Date.now()}`;
  await addOrphan(page, parentName);

  const parentGroup = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${parentName}"`) })
    .first();
  await expect(parentGroup.locator("circle")).toHaveAttribute("r", /\d+/);
  const parentBb = await parentGroup.locator("circle").boundingBox();
  if (!parentBb) throw new Error("no parent bbox");
  const parentCx = parentBb.x + parentBb.width / 2;
  const parentCy = parentBb.y + parentBb.height / 2;

  const pressAndDrag = async (fromX: number, fromY: number, toX: number, toY: number) => {
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + 30, fromY + 30, { steps: 4 });
    await page.mouse.move(toX, toY, { steps: 12 });
    await page.waitForTimeout(100);
  };

  await pressAndDrag(parentCx, parentCy, parentCx + 280, parentCy + 120);
  await page.mouse.up();
  const pendingFam = page.locator("svg#chart g[id^='family_pending-family-']").first();
  await expect(pendingFam.locator("circle")).toHaveAttribute("r", /\d+/, { timeout: 5_000 });
  const pendingCenter = await pendingFam.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  await pressAndDrag(pendingCenter.x, pendingCenter.y, pendingCenter.x + 240, pendingCenter.y + 120);
  await page.mouse.up();
  const nameInput = page.getByTestId("v3-person-name-input");
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  const childName = `Child${Date.now()}`;
  await nameInput.fill(childName);
  await page.getByTestId("v3-person-create").click();

  const realChild = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${childName}"`) })
    .first();
  await expect(realChild).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator("svg#chart g[id^='family_']:not([id*='pending-'])"),
  ).toHaveCount(1, { timeout: 10_000 });
  await expect(realChild).toHaveAttribute("transform", /translate\(/);

  await page.mouse.move(5, 5);
  await expect(page.locator("svg#chart g.v3-ghost")).toHaveCount(0, { timeout: 3_000 });

  const readTranslate = async (loc: ReturnType<Page["locator"]>) =>
    await loc.evaluate((el) => {
      const t = el.getAttribute("transform") ?? "";
      const m = t.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
    });

  const parentAgain = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${parentName}"`) })
    .first();
  await parentAgain.locator("circle").first().hover({ force: true });

  const ghostChild = page.locator("svg#chart #ghost-person-child");
  await expect(ghostChild).toHaveCount(1, { timeout: 5_000 });
  // Let the ghost-sim collide force settle (alphaDecay=0.04).
  await page.waitForTimeout(900);

  const realChildPos = await readTranslate(realChild);
  const ghostPos = await readTranslate(ghostChild);
  expect(realChildPos && ghostPos).toBeTruthy();

  // Ghost-child and real child don't merge into one node. personR=15, so
  // require ≥2·personR centre-to-centre — either the static layout or the
  // ghost-sim must keep them apart.
  const dx = ghostPos!.x - realChildPos!.x;
  const dy = ghostPos!.y - realChildPos!.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  expect(dist).toBeGreaterThanOrEqual(2 * 15);
});

test("v3 no ghosts in view mode", async ({ page }) => {
  await page.goto("/v3");
  await expect(page.getByTestId("v3-chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `ViewMode${Date.now()}`;
  await addOrphan(page, name);
  await leaveEditMode(page);
  await page.waitForTimeout(500);

  const group = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${name}"`) })
    .first();

  const circle = group.locator("circle").first();
  await circle.hover({ force: true });
  await page.waitForTimeout(400);

  // In view mode no ghosts should ever appear.
  const ghosts = page.locator("svg#chart g.v3-ghost");
  await expect(ghosts).toHaveCount(0, { timeout: 2_000 });
});
