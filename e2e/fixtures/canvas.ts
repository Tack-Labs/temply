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
 * of its own is the reliable way in.
 *
 * The way in is a click in the document's last top-level textblock and End
 * to the end of that line, because no "end of document" chord is dependable
 * here: Blink binds Ctrl+End to it and nothing to Meta+End, and Meta+Down,
 * which macOS does bind, is honoured only now and then in this Chromium. A
 * click on any `p` instead of a top-level one would be worse than a no-op —
 * the last paragraph of a document that ends in a Section lives inside it,
 * and the block would then be built in there. End is the end of the visual
 * line rather than of the block, so a trailing paragraph long enough to
 * wrap is split instead of appended to; the assertion below is what tells
 * a caller that, and the answer is to seed shorter text.
 *
 * What is then guaranteed is structural: the canvas's last top-level child
 * is a `p` and that `p` is empty. Emptiness alone would be no guarantee at
 * all — an `hr`, a Spacer, an image and a fresh Section all hold no text,
 * so the check would pass on a paragraph opened in the middle of the
 * document. A click in a top-level textblock is this helper's only way in,
 * and nothing puts one at the end for it: the `TrailingNode` extension in
 * the editor's own tree is registered by no kit. So a document whose last
 * block is a Section, a list or a divider gets its new line in the middle,
 * and this says so at once rather than leaving a later assertion to pass
 * on a block nested where no one looks.
 */
export async function newLine(page: Page): Promise<void> {
  const pm = await ready(page);
  const textblocks = pm.locator('> :is(p, h1, h2, h3, blockquote)');
  await expect(textblocks, 'the document has no top-level textblock, which is this helper\'s only way in: seed one, since nothing guarantees a trailing paragraph — TrailingNode is not registered').not.toHaveCount(0);
  await textblocks.last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  const last = pm.locator('> *').last();
  await expect(last, 'the new line is the last block of the document').toHaveJSProperty('tagName', 'P');
  await expect(last).toBeEmpty();
}

/**
 * A row of the block menu. The panel is a tippy popup with no role and no
 * name — `#slash-command` is the product's own id for it (a finding; a menu
 * of choices should carry a role and a name), and it scopes the rows so a
 * title that also names something else on the page cannot match. A row's
 * accessible name is its title followed by its description, so the title is
 * matched from the start of that name and to a word boundary: a plain
 * substring would let `Image` answer for `Inline Image` as well. The title
 * is escaped on the way into the pattern so that a future block whose name
 * carries a regex character cannot turn into a different pattern or throw;
 * a name ending in one — `C++` — would still need its own boundary rule.
 */
export function slashRow(page: Page, title: string): Locator {
  const literal = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.locator('#slash-command').getByRole('button', { name: new RegExp(`^${literal}\\b`) });
}

/**
 * Inserts a block the way a customer does: a new line, `/`, then the row.
 * The menu closing is what says the command has run, and the canvas taking
 * the focus back off the clicked row is what says the next keystroke will
 * reach the document: type before that and the first characters are lost
 * on the row that is going away. The id going away is not proof the panel
 * did — a query that matches nothing renders a "No result" panel without
 * it — so the focus check is what makes the pair conclusive. `Headers` and
 * `Footers` open a sub-list instead of inserting, so neither comes through
 * here.
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

/**
 * A floating menu or popup is on screen where the customer can use it.
 * Tippy parks a menu that has lost its anchor at x ≈ -1000 rather than
 * hiding it, and a menu wider than the pane pushes the page sideways —
 * those are the two ways "anchored" fails.
 *
 * Every edge is held to the viewport, not to a slack margin around it: a
 * popup whose first rows sit above the fold is as unusable as one parked off
 * to the side, and it is the top rows a menu puts its commonest choices in.
 * The one pixel of give on the far edges is for a box that rounds to the
 * viewport's own width or height. Being inside the viewport is not the same
 * as being reachable — a popup can still be clipped by a pane it overflows —
 * so a case that cares about reachability says so against the pane itself.
 */
export async function expectOnScreen(page: Page, box: Locator, what: string): Promise<void> {
  await expect(box, `${what} is visible`).toBeVisible();
  const rect = await box.boundingBox();
  const viewport = page.viewportSize();
  expect(rect, `${what} has a box`).not.toBeNull();
  expect(viewport, 'the page has a viewport').not.toBeNull();
  expect(rect!.x, `${what} has not lost its anchor`).toBeGreaterThan(-100);
  expect(rect!.x, `${what} starts inside the viewport`).toBeLessThan(viewport!.width);
  expect(rect!.y, `${what} starts below the top of the viewport`).toBeGreaterThanOrEqual(0);
  expect(rect!.y, `${what} starts above the fold`).toBeLessThan(viewport!.height);
  expect(rect!.x + rect!.width, `${what} ends inside the viewport`).toBeLessThanOrEqual(viewport!.width + 1);
  expect(rect!.y + rect!.height, `${what} ends above the fold`).toBeLessThanOrEqual(viewport!.height + 1);
  const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(scrolls, `${what} does not push the page sideways`).toBe(false);
}

/** A tiptap node as it is stored: the shape a caller reads `content` off. */
type SavedDoc = { type: string; content?: unknown[]; attrs?: Record<string, unknown> };

/** The document as the server holds it, for assertions the canvas cannot make. */
export async function docOf(api: ReturnType<typeof makeApi>, id: string): Promise<SavedDoc> {
  return JSON.parse((await api.getTemplate(id)).content) as SavedDoc;
}
