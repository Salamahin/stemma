import { expect, test } from "./_fixtures";
import { waitForFirstLoginSeeded } from "./_seeded";
import { chartSnapshot } from "./_chart";

test("the minimap is drawn on a canvas and pans the chart when clicked", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);
  await expect.poll(async () => (await chartSnapshot(page)).nodes.length, { timeout: 30_000 }).toBeGreaterThan(10);

  await page.getByTestId("edit-fab").click();
  const minimap = page.getByTestId("minimap");
  await expect(minimap).toBeVisible();
  expect(await minimap.evaluate((el) => el.tagName)).toBe("CANVAS");

  // Some pixels are painted: the nodes and the viewport frame.
  await expect
    .poll(async () =>
      minimap.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let painted = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
        return painted;
      }),
    )
    .toBeGreaterThan(50);

  const before = (await chartSnapshot(page) as unknown as { transform: { x: number; y: number } }).transform;
  const box = (await minimap.boundingBox())!;
  await page.mouse.click(box.x + 5, box.y + 5);
  await expect
    .poll(async () => {
      const t = (await chartSnapshot(page) as unknown as { transform: { x: number; y: number } }).transform;
      return Math.hypot(t.x - before.x, t.y - before.y);
    })
    .toBeGreaterThan(5);
});
