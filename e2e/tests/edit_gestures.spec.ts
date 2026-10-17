import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";
import { chartSnapshot, expectPersonVisible, ghostPersons, hoverNode } from "./_chart";
import { addOrphan, clickGhost, createFreshStemma, enterEditMode, leaveEditMode, nodeByName } from "./_edit";

const transform = async (page: Page) => (await chartSnapshot(page)).transform as { x: number; y: number; k: number };

async function freshStemmaWith(page: Page, names: string[]) {
  await page.goto("/");
  await expect(page.getByTestId("chip-stemma-btn")).toBeVisible({ timeout: 30_000 });
  await createFreshStemma(page);
  await enterEditMode(page);
  for (const n of names) await addOrphan(page, n);
  await page.waitForTimeout(500);
}

test("dragging a person in edit mode moves it, links nothing, and it stays there", async ({ page }) => {
  const a = `Mover${Date.now()}`;
  const b = `Other${Date.now()}`;
  await freshStemmaWith(page, [a, b]);
  const before = (await expectPersonVisible(page, a))!;
  const families = (await chartSnapshot(page)).nodes.filter((n) => n.type === "family").length;
  const { k } = await transform(page);

  await page.mouse.move(before.clientX, before.clientY);
  await page.mouse.down();
  await page.mouse.move(before.clientX + 80, before.clientY + 40, { steps: 5 });
  await page.mouse.move(before.clientX + 200, before.clientY + 120, { steps: 8 });
  await page.mouse.up();

  const target = { x: before.x + 200 / k, y: before.y + 120 / k };
  const moved = (await nodeByName(page, a))!;
  expect(Math.hypot(moved.x - target.x, moved.y - target.y)).toBeLessThan(3);
  // no card, no new family: a drag only moves
  await expect(page.getByTestId("person-name-input")).toBeHidden();
  expect((await chartSnapshot(page)).nodes.filter((n) => n.type === "family").length).toBe(families);
  // the ghosts come back where the node now is
  await expect.poll(async () => (await ghostPersons(page)).length, { timeout: 5_000 }).toBeGreaterThan(0);

  // it belongs there: leaving edit mode and reopening keep it
  await page.mouse.move(5, 300);
  await leaveEditMode(page);
  await page.waitForTimeout(5_000); // relax + debounced save
  const relaxed = (await nodeByName(page, a))!;
  expect(Math.hypot(relaxed.x - target.x, relaxed.y - target.y)).toBeLessThan(40);
  await page.reload();
  await expect.poll(async () => !!(await nodeByName(page, a)), { timeout: 30_000 }).toBe(true);
  const reopened = (await nodeByName(page, a))!;
  expect(Math.hypot(reopened.x - relaxed.x, reopened.y - relaxed.y)).toBeLessThan(40);
});

test("a long press on a person in edit mode opens their card", async ({ page }) => {
  const a = `Pressed${Date.now()}`;
  await freshStemmaWith(page, [a]);
  const node = (await expectPersonVisible(page, a))!;
  await page.mouse.move(node.clientX, node.clientY);
  await page.mouse.down();
  await page.waitForTimeout(800);
  const nameInput = page.getByTestId("person-name-input");
  await expect(nameInput).toBeVisible({ timeout: 3_000 });
  await expect(nameInput).toHaveValue(a);
  await page.mouse.up();
  await expect(nameInput).toBeVisible();
  // the press did not move the person
  const after = (await nodeByName(page, a))!;
  expect([after.x, after.y]).toEqual([node.x, node.y]);
});

test("dragging empty canvas in edit mode pans", async ({ page }) => {
  const a = `Still${Date.now()}`;
  await freshStemmaWith(page, [a]);
  const snap = await chartSnapshot(page);
  const vp = page.viewportSize()!;
  // a spot well away from every node
  const spot = [
    { x: vp.width * 0.25, y: vp.height * 0.75 },
    { x: vp.width * 0.75, y: vp.height * 0.25 },
    { x: vp.width * 0.25, y: vp.height * 0.25 },
  ].find((p) => snap.nodes.every((n) => Math.hypot(n.clientX - p.x, n.clientY - p.y) > 120))!;
  const t0 = await transform(page);
  const positions = new Map(snap.nodes.map((n) => [n.id, [n.x, n.y]]));
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.move(spot.x + 150, spot.y + 60, { steps: 8 });
  await page.mouse.up();
  const t1 = await transform(page);
  expect(Math.hypot(t1.x - t0.x, t1.y - t0.y)).toBeGreaterThan(100);
  for (const n of (await chartSnapshot(page)).nodes) expect([n.x, n.y]).toEqual(positions.get(n.id));
});

test("a ghost links someone already in the tree instead of creating a namesake", async ({ page }) => {
  const child = `Child${Date.now()}`;
  const mother = `Mother${Date.now()}`;
  await freshStemmaWith(page, [child, mother]);
  const people = (await chartSnapshot(page)).nodes.filter((n) => n.type === "person").length;
  const kid = (await expectPersonVisible(page, child))!;
  await hoverNode(page, kid.id);
  // the parent ghost sits above: the way there crosses nobody else
  await clickGhost(page, "ghost-person-parent");

  // typing the name offers the people already in the tree that fit
  await page.getByTestId("person-name-input").fill(mother.slice(0, 8));
  const option = page.getByTestId("existing-person-option").filter({ hasText: mother });
  await expect(option).toHaveCount(1);
  // the person themself is never offered
  await expect(page.getByTestId("existing-person-option").filter({ hasText: child })).toHaveCount(0);
  await option.click();
  await expect(page.getByTestId("person-details-modal")).toBeHidden();

  // one family: the existing mother as parent, the kid as child; nobody new
  const motherId = (await nodeByName(page, mother))!.id;
  await expect
    .poll(
      async () => {
        const snap = await chartSnapshot(page);
        const fam = snap.nodes.find((n) => n.type === "family" && !n.id.includes("pending-"));
        if (!fam) return "no family";
        const parents = snap.edges.filter((e) => e.type === "spouseToFamily" && e.target === fam.id).map((e) => e.source);
        const children = snap.edges.filter((e) => e.type === "familyToChild" && e.source === fam.id).map((e) => e.target);
        return JSON.stringify({ parents, children });
      },
      { timeout: 15_000 },
    )
    .toBe(JSON.stringify({ parents: [motherId], children: [kid.id] }));
  expect((await chartSnapshot(page)).nodes.filter((n) => n.type === "person").length).toBe(people);
});
