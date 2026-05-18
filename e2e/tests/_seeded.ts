import { expect, type Page } from "@playwright/test";

export const SEEDED_STEMMA_COUNT = 2;

export async function waitForFirstLoginSeeded(page: Page) {
  await expect(page.locator("#navbarDropdownMenuLink")).toBeVisible();
  await expect(page.locator(".dropdown-menu .stemma-row")).toHaveCount(
    SEEDED_STEMMA_COUNT,
    { timeout: 30_000 },
  );
}
