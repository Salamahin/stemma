import { expect, test } from "./_fixtures";
import type { Page } from "@playwright/test";

async function createStemma(page: Page, name: string) {
  const stemmaBtn = page.getByTestId("chip-stemma-btn");
  await expect(stemmaBtn).toBeVisible({ timeout: 30_000 });
  await stemmaBtn.click();
  await page.getByTestId("chip-add-stemma").click();
  const modal = page.getByTestId("add-stemma-modal");
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await modal.locator("input").fill(name);
  await modal.locator("button.btn-primary").click();
  await expect(stemmaBtn).toContainText(name, { timeout: 15_000 });
}

async function addPerson(page: Page, name: string) {
  await page.getByTestId("edit-fab").click();
  await expect(page.locator(".edit-mode")).toHaveCount(1);
  await page.getByTestId("add-person-fab").click();
  await page.getByTestId("person-name-input").fill(name);
  await page.getByTestId("person-create").click();
  const node = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${name}"`) })
    .first();
  await expect(node).toBeVisible({ timeout: 15_000 });
  return node;
}

test("invite link grants the invitee access to the stemma", async ({ page, browser }, testInfo) => {
  const stemmaName = `Invite${Date.now()}`;
  const personName = `Invitee${Date.now()}`;
  const inviteeEmail = `e2e-invitee-${testInfo.testId}@stemma.local`;

  await page.goto("/");
  await createStemma(page, stemmaName);
  const node = await addPerson(page, personName);

  await node.locator("circle").first().click({ force: true });
  await page.getByTestId("share-access-btn").click();
  const modal = page.getByTestId("share-access-modal");
  await expect(modal).toBeVisible();
  await page.getByTestId("share-access-email").fill(inviteeEmail);
  await page.getByTestId("share-access-create").click();

  const linkInput = page.getByTestId("share-access-link");
  await expect(linkInput).toHaveValue(/\?inviteToken=[^&]+$/, { timeout: 15_000 });
  await expect(page.getByTestId("share-access-copy-status")).toBeVisible();
  const link = await linkInput.inputValue();
  // The link is wrapped exactly once, so the token must not hold a nested url.
  expect(new URL(link).searchParams.get("inviteToken")).not.toContain("inviteToken");

  const invitee = await browser.newContext();
  try {
    await invitee.addInitScript((t) => {
      (window as unknown as { __STEMMA_E2E_USER__: string }).__STEMMA_E2E_USER__ = t;
    }, inviteeEmail);
    const inviteePage = await invitee.newPage();
    await inviteePage.goto(link);

    const chip = inviteePage.getByTestId("chip-stemma-btn");
    await expect(chip).toContainText(stemmaName, { timeout: 30_000 });
    await expect(inviteePage).not.toHaveURL(/inviteToken/);
    await expect(
      inviteePage.locator("svg#chart g[id^='person_']").filter({ has: inviteePage.locator(`text="${personName}"`) }),
    ).toHaveCount(1, { timeout: 15_000 });
  } finally {
    await invitee.close();
  }
});
