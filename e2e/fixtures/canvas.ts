import { expect, type Locator, type Page } from '@playwright/test';
import type { makeApi } from './api';

/** The editor's canvas. ProseMirror's class names are its public contract. */
export function canvas(page: Page): Locator {
  return page.locator('.ProseMirror');
}

/**
 * The canvas, once tiptap has attached. The editor is server-rendered and
 * focusable before that, and a click or a keystroke in the meantime is
 * dropped without a trace.
 */
export async function ready(page: Page): Promise<Locator> {
  const pm = canvas(page);
  await pm.waitFor();
  return pm;
}

/** Opens a template in the editor and hands back its canvas. */
export async function openEditor(page: Page, id: string): Promise<Locator> {
  await page.goto(`/templates/${id}`);
  return ready(page);
}

/**
 * A fresh empty paragraph at the end of the document, with the caret in it.
 * The block menu's `/` has to start a textblock or follow a space, so a line
 * of its own is the reliable way in; the caret is put at the very end first
 * because the last block may be an image or a divider a click would select.
 */
export async function newLine(page: Page): Promise<void> {
  const pm = await ready(page);
  await pm.locator('p').last().click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
}

/**
 * A row of the block menu. The panel is a tippy popup with no role and no
 * name — `#slash-command` is the product's own id for it (a finding; a menu
 * of choices should carry a role and a name), and it scopes the rows so a
 * title that also names something else on the page cannot match. A row's
 * accessible name is its title followed by its description, so the title is
 * matched from the start of that name and to a word boundary: a plain
 * substring would let `Image` answer for `Inline Image` as well.
 */
export function slashRow(page: Page, title: string): Locator {
  return page.locator('#slash-command').getByRole('button', { name: new RegExp(`^${title}\\b`) });
}

/**
 * Inserts a block the way a customer does: a new line, `/`, then the row.
 * The menu closing is what says the command has run, and the canvas taking
 * the focus back off the clicked row is what says the next keystroke will
 * reach the document: type before that and the first characters are lost
 * on the row that is going away. `Headers` and `Footers` open a sub-list
 * instead of inserting, so neither comes through here.
 */
export async function insertViaSlash(page: Page, title: string): Promise<void> {
  await newLine(page);
  await page.keyboard.type('/');
  await expect(slashRow(page, title)).toBeVisible();
  await slashRow(page, title).click();
  await expect(page.locator('#slash-command')).toBeHidden();
  await expect(canvas(page)).toBeFocused();
}

/**
 * The bubble menu holding a control. Tippy re-parents every menu into a
 * `.tippy-box`, which is the element that carries `data-placement` and the
 * box an anchoring assertion measures; the menus themselves have no
 * accessible name (a finding).
 */
export function bubbleMenu(page: Page, containing: Locator | string): Locator {
  const has = typeof containing === 'string' ? page.getByRole('button', { name: containing }) : containing;
  return page.locator('.tippy-box').filter({ has });
}

/** The document as the server holds it, for assertions the canvas cannot make. */
export async function docOf(api: ReturnType<typeof makeApi>, id: string): Promise<Record<string, unknown>> {
  return JSON.parse((await api.getTemplate(id)).content) as Record<string, unknown>;
}
