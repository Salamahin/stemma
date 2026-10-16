import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";
import {
  chartSnapshot,
  expectPersonVisible,
  ghostById,
  ghostFamilies,
  ghostPersons,
  hoverNode,
  nodeById,
} from "./_chart";

async function createFreshStemma(page: Page) {
  const stemmaBtn = page.getByTestId("chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 10_000 });
  await stemmaBtn.click();
  const addBtn = page.getByTestId("chip-add-stemma");
  await expect(addBtn).toBeVisible({ timeout: 5_000 });
  await addBtn.click();
  const modal = page.getByTestId("add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await modal.locator("input").fill(`smoke-${Date.now()}`);
  await modal.locator("button.btn-primary").click();
  await page.waitForTimeout(2_500);
}

async function enterEditMode(page: Page) {
  await page.getByTestId("edit-fab").click();
  await expect(page.locator(".edit-mode")).toHaveCount(1);
}

async function leaveEditMode(page: Page) {
  await page.getByTestId("edit-fab").click();
  await expect(page.locator(".edit-mode")).toHaveCount(0);
}

async function addOrphan(page: Page, name: string) {
  await page.getByTestId("add-person-fab").click();
  const nameInput = page.getByTestId("person-name-input");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByTestId("person-create").click();
  await expectPersonVisible(page, name, 15_000);
}

const ghostPersonCount = async (page: Page) => (await ghostPersons(page)).length;

test("/route loads with chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
});

test("hover in edit mode reveals ghost nodes; moving away clears them", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Hovered${Date.now()}`;
  await addOrphan(page, name);
  await page.waitForTimeout(500);

  const group = await expectPersonVisible(page, name);

  // Hover over the circle directly so the mousemove fires on the canvas and
  // the distance-based hit detection can focus the node.
  await hoverNode(page, group.id);
  await page.waitForTimeout(400);

  // An orphan person has no parent family, so three ghost branches render:
  // spouse, parent, child → 3 ghost person nodes plus ghost family nodes.
  // Assert on ghost persons only.
  await expect.poll(() => ghostPersonCount(page), { timeout: 5_000 }).toBe(3);

  // Move pointer away from any node to trigger blur.
  await page.mouse.move(5, 5);
  await expect.poll(() => ghostPersonCount(page), { timeout: 3_000 }).toBe(0);
});

test("orphan ghost layout: shared east family for spouse+child, parent family above", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `Layout${Date.now()}`;
  await addOrphan(page, name);
  await page.waitForTimeout(500);

  const group = await expectPersonVisible(page, name);
  await hoverNode(page, group.id);
  await page.waitForTimeout(400);

  // Exactly two ghost family nodes: one shared east, one parent.
  await expect.poll(async () => (await ghostFamilies(page)).length, { timeout: 5_000 }).toBe(2);
  const countGhost = async (id: string) =>
    (await chartSnapshot(page)).ghosts.filter((g) => g.id === id).length;
  expect(await countGhost("ghost-family-east")).toBe(1);
  expect(await countGhost("ghost-family-parent")).toBe(1);

  // Three ghost persons: spouse, child, parent.
  expect(await countGhost("ghost-person-spouse")).toBe(1);
  expect(await countGhost("ghost-person-child")).toBe(1);
  expect(await countGhost("ghost-person-parent")).toBe(1);

  // Rendered centre (user space) of a real node or ghost.
  const readTranslate = async (id: string) => {
    const g = await ghostById(page, id);
    if (g) return { x: g.x, y: g.y };
    const n = await nodeById(page, id);
    return n ? { x: n.x, y: n.y } : null;
  };

  const focusPos = await readTranslate(group.id);
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

test("ghost-child stays separated from an existing real child", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);

  const parentName = `Parent${Date.now()}`;
  await addOrphan(page, parentName);

  const parentGroup = await expectPersonVisible(page, parentName);
  expect(parentGroup.r).toBeGreaterThan(0);
  const parentCx = parentGroup.clientX;
  const parentCy = parentGroup.clientY;

  const pressAndDrag = async (fromX: number, fromY: number, toX: number, toY: number) => {
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + 30, fromY + 30, { steps: 4 });
    await page.mouse.move(toX, toY, { steps: 12 });
    await page.waitForTimeout(100);
  };

  await pressAndDrag(parentCx, parentCy, parentCx + 280, parentCy + 120);
  await page.mouse.up();
  const pendingFamily = async () =>
    (await chartSnapshot(page)).nodes.find((n) => n.id.startsWith("family_pending-family-")) ?? null;
  await expect.poll(async () => ((await pendingFamily())?.r ?? 0) > 0 && (await pendingFamily())!.drawn, { timeout: 5_000 }).toBe(true);
  const pendingNode = (await pendingFamily())!;
  const pendingCenter = { x: pendingNode.clientX, y: pendingNode.clientY };

  await pressAndDrag(pendingCenter.x, pendingCenter.y, pendingCenter.x + 240, pendingCenter.y + 120);
  await page.mouse.up();
  const nameInput = page.getByTestId("person-name-input");
  await expect(nameInput).toBeVisible({ timeout: 5_000 });
  const childName = `Child${Date.now()}`;
  await nameInput.fill(childName);
  await page.getByTestId("person-create").click();

  const realChild = await expectPersonVisible(page, childName, 15_000);
  await expect
    .poll(async () => (await chartSnapshot(page)).nodes.filter((n) => n.type === "family" && !n.id.includes("pending-")).length, { timeout: 10_000 })
    .toBe(1);
  expect(Number.isFinite(realChild.x) && Number.isFinite(realChild.y)).toBe(true);

  await page.mouse.move(5, 5);
  await expect.poll(() => ghostPersonCount(page), { timeout: 3_000 }).toBe(0);

  const parentAgain = await expectPersonVisible(page, parentName);
  await hoverNode(page, parentAgain.id);

  await expect
    .poll(async () => (await chartSnapshot(page)).ghosts.filter((g) => g.id === "ghost-person-child").length, { timeout: 5_000 })
    .toBe(1);
  // Let the ghost-sim collide force settle (alphaDecay=0.04).
  await page.waitForTimeout(900);

  const realChildNow = await nodeById(page, realChild.id);
  const ghostChild = await ghostById(page, "ghost-person-child");
  const realChildPos = realChildNow ? { x: realChildNow.x, y: realChildNow.y } : null;
  const ghostPos = ghostChild ? { x: ghostChild.x, y: ghostChild.y } : null;
  expect(realChildPos && ghostPos).toBeTruthy();

  // Ghost-child and real child don't merge into one node. personR=15, so
  // require ≥2·personR centre-to-centre — either the static layout or the
  // ghost-sim must keep them apart.
  const dx = ghostPos!.x - realChildPos!.x;
  const dy = ghostPos!.y - realChildPos!.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  expect(dist).toBeGreaterThanOrEqual(2 * 15);
});

test("no ghosts in view mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  const name = `ViewMode${Date.now()}`;
  await addOrphan(page, name);
  await leaveEditMode(page);
  await page.waitForTimeout(500);

  const group = await expectPersonVisible(page, name);
  await hoverNode(page, group.id);
  await page.waitForTimeout(400);

  // In view mode no ghosts should ever appear.
  await expect.poll(() => ghostPersonCount(page), { timeout: 2_000 }).toBe(0);
  expect(await ghostPersonCount(page)).toBe(0);
});
