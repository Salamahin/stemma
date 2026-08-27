import { expect, test } from "./_fixtures";
import { waitForFirstLoginSeeded } from "./_seeded";

test("a favourite stemma is opened by default after a reload", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);

  const chipBtn = page.getByTestId("chip-stemma-btn");
  await chipBtn.click();
  const dropdown = page.getByTestId("chip-dropdown");
  await expect(dropdown).toBeVisible();

  // Row 0 is the seeded default that opens on a first login, so favouriting row 1
  // proves the mark wins over both the seeded default and the last-visited id.
  const secondRow = dropdown.locator(".stemma-row").nth(1);
  const favouriteName = (await secondRow.locator(".row-name").innerText()).trim();
  await secondRow.getByTestId("chip-favourite").click();

  await page.reload();
  await expect(chipBtn).toHaveText(favouriteName, { timeout: 30_000 });

  // The star is rendered as filled for the stemma that is currently marked.
  await chipBtn.click();
  await expect(dropdown).toBeVisible();
  await expect(
    dropdown.locator(".stemma-row").nth(0).getByTestId("chip-favourite").locator("i"),
  ).toHaveClass(/bi-star-fill/);
});
