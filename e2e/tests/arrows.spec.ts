import { expect, test } from "@playwright/test";
import { waitForFirstLoginSeeded } from "./_seeded";

test("relationship arrows are rendered on a populated stemma", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);

  const svg = page.locator("svg#chart");
  await expect(svg).toBeVisible();
  await expect(svg.locator("line")).not.toHaveCount(0, { timeout: 30_000 });

  await expect(svg.locator('defs marker[id^="arrow-to-family-"]')).toHaveCount(1);
  await expect(svg.locator('defs marker[id^="arrow-to-person-"]')).toHaveCount(1);
  await expect(svg.locator("line:not([marker-end])")).toHaveCount(0);

  // Each line's url(#...) must resolve inside the same SVG; a marker hidden in
  // another SVG won't render even if the lookup succeeds.
  const refIssues = await svg.locator("line").evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const ref = node.getAttribute("marker-end") ?? "";
      const match = ref.match(/^url\(#(.+)\)$/);
      if (!match) return [{ ref, problem: "no-url" }];
      const target = document.getElementById(match[1]);
      if (!target) return [{ ref, problem: "missing" }];
      if (!node.ownerSVGElement?.contains(target)) {
        return [{ ref, problem: "wrong-svg", parentSvg: target.closest("svg")?.id ?? null }];
      }
      return [];
    }),
  );
  expect(refIssues).toEqual([]);
});
