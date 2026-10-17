import { expect, type Page } from "@playwright/test";
import { expectPersonVisible } from "./_chart";

/** Opens the card of a committed person by clicking their node on the chart canvas. */
export async function openPersonCard(page: Page, name: string) {
  const node = await expectPersonVisible(page, name);
  await page.mouse.click(node.clientX, node.clientY);
  // editable card: a name field; read-only card: the name as text
  const editable = page.getByTestId("person-name-input");
  const viewed = page.getByTestId("person-view-name");
  await expect(editable.or(viewed)).toBeVisible({ timeout: 5_000 });
  if (await editable.isVisible()) await expect(editable).toHaveValue(name);
  else await expect(viewed).toHaveText(name);
}

/** Unfolds "More" (other names, bio, attachments) of an editable card. */
export async function openMore(page: Page) {
  const more = page.getByTestId("person-more");
  if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
}
