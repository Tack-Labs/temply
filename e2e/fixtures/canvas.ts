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
 * and the block would then be built in there.
 *
 * End means two different things by platform, and the assertions below are
 * what make both safe. On Linux it is the end of the visual line, so a
 * trailing paragraph long enough to wrap is split instead of appended to —
 * the emptiness check is what tells a caller that, and the answer is to seed
 * shorter text. On macOS this Chromium takes it as the end of the *document*
 * — the very move the premise above calls undependable by chord — so it can
 * leave the caret in a block that is not the one clicked. Here the two land
 * in the same place, the click's target being the last textblock; where they
 * would not, the structural check below says so rather than letting the line
 * be built somewhere nobody looks. A caller that needs a line anywhere other
 * than the end of the document must not reach for End.
 *
 * What is then guaranteed is structural: the canvas's last top-level child
 * is a `p` and that `p` is empty. Emptiness alone would be no guarantee at
 * all — an `hr`, a Spacer, an image and a fresh Section all hold no text,
 * so the check would pass on a paragraph opened in the middle of the
 * document. A click in a top-level textblock is this helper's only way in,
 * and the editor's `TrailingNode` keeps one at the end only where a caret
 * has nowhere else to go: a document ending in a list or a blockquote. A
 * document ending in a Section, a divider, an image or a Footer is left
 * exactly as it is, since a gap cursor already fits after those — so most
 * documents give this helper nothing to click, and the structural check
 * below is what says so rather than letting a line be built in the middle of
 * the document, which is worse than a failure here.
 */
export async function newLine(page: Page): Promise<void> {
  const pm = await ready(page);
  const textblocks = pm.locator('> :is(p, h1, h2, h3, blockquote)');
  await expect(textblocks, 'the document has no top-level textblock, which is this helper\'s only way in: seed one, since the trailing paragraph TrailingNode keeps is only for a document ending in a list or a blockquote').not.toHaveCount(0);
  await textblocks.last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  const last = pm.locator('> *').last();
  await expect(last, 'the new line is the last block of the document').toHaveJSProperty('tagName', 'P');
  await expect(last).toBeEmpty();
}

/** The block menu: a listbox of blocks to insert, named as the cheatsheet
 *  names it. A query matching nothing renders a status in its place, so this
 *  going away is also how the empty state is told apart. */
export function slashMenu(page: Page): Locator {
  return page.getByRole('listbox', { name: 'Block menu' });
}

/**
 * A row of the block menu, by the block it inserts. The row is named for the
 * block and nothing else — it used to be the title and the description run
 * together, which needed a word-boundary regex here to keep `Image` from
 * answering for `Inline Image`.
 */
export function slashRow(page: Page, title: string): Locator {
  return slashMenu(page).getByRole('option', { name: title, exact: true });
}

/**
 * Inserts a block the way a customer does: a new line, `/`, then the row.
 * The menu closing is what says the command has run. The listbox going away
 * is not proof the panel did — a query that matches nothing puts a status in
 * its place — so the focus check below is what makes the pair conclusive; it
 * also holds the product to never handing the focus to the row in the first
 * place, since a canvas that had to take it back would lose whatever was
 * typed in between. `Headers` and `Footers` open a sub-list instead of
 * inserting, so neither comes through here.
 */
export async function insertViaSlash(page: Page, title: string): Promise<void> {
  await newLine(page);
  await page.keyboard.type('/');
  await expect(slashRow(page, title)).toBeVisible();
  await slashRow(page, title).click();
  await expect(slashMenu(page)).toBeHidden();
  await expect(canvas(page)).toBeFocused();
}

/**
 * Inserts a block where the caret already is, rather than at the end of the
 * document — the way a customer puts one inside a Section or a Repeat.
 * The caret must be in an empty textblock, since `/` has to start one.
 *
 * Neither wait `insertViaSlash` makes is made here: this returns as soon as
 * the row is clicked, with the panel possibly still up. A caller that cares
 * that the block arrived asserts that itself. Typing straight afterwards is
 * safe — the canvas never gives up the focus to the row — and the case that
 * types with no wait at all is what holds the product to it.
 */
export async function insertHere(page: Page, title: string): Promise<void> {
  await page.keyboard.type('/');
  await expect(slashRow(page, title)).toBeVisible();
  await slashRow(page, title).click();
}

/**
 * A bubble menu, by the block it acts on. Each is a named toolbar, so the
 * name is what finds it — a menu used to be identifiable only by a control it
 * happened to hold, which is how a screen reader met it too.
 *
 * The `.tippy-box` around it is what the locator returns rather than the
 * toolbar itself: tippy re-parents every menu into one, and that box is the
 * element carrying `data-placement` and the geometry an anchoring assertion
 * measures.
 */
export function bubbleMenu(page: Page, name: string): Locator {
  return page.locator('.tippy-box').filter({ has: page.getByRole('toolbar', { name, exact: true }) });
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
