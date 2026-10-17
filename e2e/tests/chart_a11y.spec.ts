import { expect, test } from "./_fixtures";
import { waitForFirstLoginSeeded } from "./_seeded";
import { chartSnapshot } from "./_chart";

test("the chart can be explored with the keyboard and a screen reader", async ({ page }) => {
  await page.goto("/");
  await waitForFirstLoginSeeded(page);
  await expect.poll(async () => (await chartSnapshot(page)).nodes.length, { timeout: 30_000 }).toBeGreaterThan(10);

  // Screen readers get the people of the tree as a list, kept out of the Tab order.
  const list = page.getByTestId("chart-people");
  const persons = (await chartSnapshot(page)).nodes.filter((n) => n.type === "person").length;
  await expect(list.locator("li")).toHaveCount(persons);
  expect(await list.locator("button").first().getAttribute("tabindex")).toBe("-1");

  const canvas = page.locator("canvas#chart");
  await canvas.focus();
  const announcer = page.getByTestId("chart-announcer");

  await page.keyboard.press("ArrowRight");
  await expect(announcer).not.toHaveText("");
  const first = await announcer.textContent();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowLeft");
  await expect(announcer).not.toHaveText(first ?? "");

  // Enter opens the focused person's card.
  const announced = (await announcer.textContent())!.split(",")[0];
  await page.keyboard.press("Enter");
  // view mode: the card shows the name as text
  const shown = page.getByTestId("person-view-name");
  await expect(shown).toBeVisible();
  const shownName = (await shown.textContent())!.trim();
  expect(announced).toContain(shownName.split(" ")[0]);
});
