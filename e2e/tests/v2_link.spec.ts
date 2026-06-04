import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragHandleOntoPerson(page: Page, fromSelector: string, toSelector: string) {
  const dt = await page.evaluateHandle(() => new DataTransfer());
  await page.dispatchEvent(fromSelector, "dragstart", { dataTransfer: dt });
  await page.dispatchEvent(toSelector, "dragenter", { dataTransfer: dt });
  await page.dispatchEvent(toSelector, "dragover", { dataTransfer: dt });
  await page.dispatchEvent(toSelector, "drop", { dataTransfer: dt });
  await page.dispatchEvent(fromSelector, "dragend", { dataTransfer: dt });
  await dt.dispose();
}

async function switchToEmptyStemma(page: Page) {
  const stemmaBtn = page.locator(".stemma-btn");
  if (await stemmaBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await stemmaBtn.click();
    await page.waitForTimeout(300);
    const emptyOption = page.getByRole("button", { name: /My family tree|Моя родословная/ }).first();
    if (await emptyOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await emptyOption.click();
      await page.waitForTimeout(1_500);
    }
  }
}

async function personGroupByName(page: Page, name: string): Promise<{ id: string; locator: Locator }> {
  const svg = page.locator("svg#chart");
  const group = svg.locator("g[id^='person_']").filter({ has: page.locator(`text="${name}"`) }).first();
  await expect(group).toBeVisible({ timeout: 10_000 });
  const id = (await group.getAttribute("id"))!.replace("person_", "");
  return { id, locator: group };
}

test("v2 bulk-add three + drag-link spouse + drag-link child", async ({ page }) => {
  await page.goto("/v2");

  const editFab = page.getByTestId("v2-edit-fab");
  await expect(editFab).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-testid='v2-empty-state'], svg#chart")).toBeVisible({ timeout: 30_000 });

  await switchToEmptyStemma(page);
  await editFab.click();

  const ts = Date.now();
  const a = `Alice${ts}`;
  const b = `Bob${ts}`;
  const c = `Carol${ts}`;

  const trayToggle = page.getByTestId("v2-tray-toggle");
  await expect(trayToggle).toBeVisible({ timeout: 5_000 });
  await trayToggle.click();

  const textarea = page.getByTestId("v2-tray-textarea");
  await expect(textarea).toBeVisible();
  await textarea.fill(`${a}\n${b}\n${c}`);
  await page.getByTestId("v2-tray-add-all").click();

  const svg = page.locator("svg#chart");
  await expect(svg.locator("text").filter({ hasText: a })).toBeVisible({ timeout: 15_000 });
  await expect(svg.locator("text").filter({ hasText: b })).toBeVisible({ timeout: 15_000 });
  await expect(svg.locator("text").filter({ hasText: c })).toBeVisible({ timeout: 15_000 });

  // Drag Alice handle → Bob node → spouse
  const alice = await personGroupByName(page, a);
  const bob = await personGroupByName(page, b);
  const carol = await personGroupByName(page, c);

  await expect(page.locator(`[data-testid='v2-drag-handle-${alice.id}']`)).toBeVisible({ timeout: 5_000 });
  await dragHandleOntoPerson(
    page,
    `[data-testid='v2-drag-handle-${alice.id}']`,
    `g#person_${bob.id} circle`,
  );

  const rolePicker = page.getByTestId("v2-link-role-menu");
  await expect(rolePicker).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("v2-link-role-spouse").click();

  await expect(svg.locator("g[id^='family_']")).toHaveCount(1, { timeout: 15_000 });

  // Drag Alice handle → Carol → role=child means Alice as parent, Carol as child
  await expect(page.locator(`[data-testid='v2-drag-handle-${alice.id}']`)).toBeVisible({ timeout: 5_000 });
  await dragHandleOntoPerson(
    page,
    `[data-testid='v2-drag-handle-${alice.id}']`,
    `g#person_${carol.id} circle`,
  );
  await expect(rolePicker).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("v2-link-role-child").click();

  // Same family now has both parents + a child (single family stays single).
  await expect(svg.locator("g[id^='family_']")).toHaveCount(1, { timeout: 15_000 });
  const familyId = (await svg.locator("g[id^='family_']").first().getAttribute("id"))!.replace("family_", "");
  const familyChildGhost = page.locator(`[data-testid='v2-family-ghost-child-${familyId}']`);
  await expect(familyChildGhost).toBeVisible({ timeout: 5_000 });
});
