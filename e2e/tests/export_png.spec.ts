import { readFileSync } from "node:fs";
import { expect, test } from "./_fixtures";
import { waitForFirstLoginSeeded } from "./_seeded";
import { chartSnapshot } from "./_chart";

test("the whole chart can be downloaded as a PNG", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);
  await expect.poll(async () => (await chartSnapshot(page)).nodes.length, { timeout: 30_000 }).toBeGreaterThan(10);

  await page.getByTestId("menu-btn").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("menu-export-png").click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);

  const bytes = readFileSync((await download.path())!);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Width and height from the IHDR chunk: a real picture of the whole chart, not a 1×1 blank.
  expect(bytes.readUInt32BE(16)).toBeGreaterThan(400);
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(300);
});
