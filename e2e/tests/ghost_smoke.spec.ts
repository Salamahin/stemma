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
import { waitForFirstLoginSeeded } from "./_seeded";

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

test("ghosts push nearby people aside while shown; they return on blur", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);
  await enterEditMode(page);
  await page.waitForTimeout(1_000);

  const before = await chartSnapshot(page);
  const start = new Map(before.nodes.map((n) => [n.id, [n.x, n.y] as const]));
  const vp = page.viewportSize()!;
  // on screen, clear of the toolbars/minimap at the edges
  const persons = before.nodes.filter(
    (n) =>
      n.type === "person" &&
      n.clientX > 150 && n.clientX < vp.width - 250 && n.clientY > 120 && n.clientY < vp.height - 150 &&
      // nobody overlapping it, so the hover focuses exactly this person
      !before.nodes.some((o) => o.id !== n.id && Math.hypot(o.clientX - n.clientX, o.clientY - n.clientY) < 40),
  );
  const crowd = (p: (typeof persons)[number]) =>
    before.nodes.filter((n) => n.id !== p.id && Math.hypot(n.x - p.x, n.y - p.y) < 200).length;
  const candidates = [...persons].sort((a, b) => crowd(b) - crowd(a)).slice(0, 10);

  const blur = async () => {
    // off the canvas (a corner may hold another node)
    const box = (await page.getByPlaceholder(/search|поиск/i).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => ghostPersonCount(page), { timeout: 3_000 }).toBe(0);
  };

  // Hover the most crowded people until one has someone where its ghosts land.
  let checked = false;
  for (const focus of candidates) {
    await hoverNode(page, focus.id);
    await expect.poll(() => ghostPersonCount(page), { timeout: 5_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1_500); // burst settles
    const during = await chartSnapshot(page);
    const ghosts = during.ghosts.filter((g) => g.id.startsWith("ghost-person"));
    const inTheWay = before.nodes.filter(
      (n) => n.id !== focus.id && ghosts.some((g) => Math.hypot(n.x - g.x, n.y - g.y) < 90),
    );
    if (inTheWay.length > 0) {
      checked = true;
      const now = new Map(during.nodes.map((n) => [n.id, n]));
      // people that were in the ghosts' way stepped aside…
      for (const n of inTheWay) {
        const m = now.get(n.id)!;
        expect(Math.hypot(m.x - n.x, m.y - n.y)).toBeGreaterThan(5);
      }
      // …the hovered one stays under the pointer…
      expect([now.get(focus.id)!.x, now.get(focus.id)!.y]).toEqual(start.get(focus.id));
      // …and nobody got piled onto anyone
      for (const m of during.nodes) {
        const [ax, ay] = start.get(m.id)!;
        if (m.x === ax && m.y === ay) continue;
        for (const n of during.nodes) {
          if (n.id === m.id) continue;
          const [bx, by] = start.get(n.id)!;
          expect(Math.hypot(m.x - n.x, m.y - n.y)).toBeGreaterThanOrEqual(Math.min(Math.hypot(ax - bx, ay - by), 60) - 1);
        }
      }
    }
    await blur();
    // they glide back to exactly where they were
    await expect
      .poll(async () => (await chartSnapshot(page)).nodes.filter((n) => n.x !== start.get(n.id)![0] || n.y !== start.get(n.id)![1]).length, { timeout: 3_000 })
      .toBe(0);
    if (checked) break;
  }
  expect(checked).toBe(true);
});
