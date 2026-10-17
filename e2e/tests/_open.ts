import { expect, type Page } from "@playwright/test";

/** Opens the card of a committed person by clicking their node on the chart. */
export async function openPersonCard(page: Page, name: string) {
  const node = page
    .locator("svg#chart g[id^='person_']:not([id*='pending-'])")
    .filter({ has: page.locator(`text="${name}"`) })
    .first();
  await expect(node).toBeVisible({ timeout: 15_000 });
  await node.locator("circle").first().click({ force: true });
  await expect(page.getByTestId("person-name-input")).toHaveValue(name, { timeout: 5_000 });
}
