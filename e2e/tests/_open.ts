import { expect, type Page } from "@playwright/test";
import { expectPersonVisible } from "./_chart";

/** Opens the card of a committed person by clicking their node on the chart canvas. */
export async function openPersonCard(page: Page, name: string) {
  const node = await expectPersonVisible(page, name);
  await page.mouse.click(node.clientX, node.clientY);
  await expect(page.getByTestId("person-name-input")).toHaveValue(name, { timeout: 5_000 });
}
