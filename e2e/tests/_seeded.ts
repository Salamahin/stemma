import { expect, type Page } from "@playwright/test";

export const SEEDED_STEMMA_COUNT = 2;

export async function waitForFirstLoginSeeded(page: Page) {
  const chipBtn = page.getByTestId("chip-stemma-btn");
  await expect(chipBtn).toBeVisible({ timeout: 30_000 });
  await chipBtn.click();
  const dropdown = page.getByTestId("chip-dropdown");
  await expect(dropdown).toBeVisible({ timeout: 5_000 });
  await expect(dropdown.locator(".stemma-row")).toHaveCount(
    SEEDED_STEMMA_COUNT,
    { timeout: 30_000 },
  );
  await chipBtn.click();
  await expect(dropdown).toBeHidden({ timeout: 5_000 });
}
