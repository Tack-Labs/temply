import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import type { makeApi } from '../fixtures/api';
import { bubbleMenu, canvas, expectOnScreen, insertViaSlash, newLine, openEditor, slashRow } from '../fixtures/canvas';

// The canvas is a contenteditable, so ProseMirror's own class names stand in
// for roles it does not give, and a node view's `data-type` stands in for
// what a block is. A Spacer carries no `data-type` at all — it is a band of
// nothing — so its own `data-maily-component` is what says it is one.
// `#slash-command` and `.tippy-box` are the two other exceptions this file
// needs, both explained where they are used.

/** What a test hands the opener below: its own page and its own seeding. */
type Seeding = { page: Page; api: ReturnType<typeof makeApi>; name: (what: string) => string };

/**
 * A fresh template of its own, open in the editor, per block a test needs.
 *
 * A second insert on the same document lands inside the first block rather
 * than after it: the caret is left inside the Section or the list, and
 * nothing puts a paragraph after it to carry the next `/` — TrailingNode is
 * not registered, so `newLine`, the only way in, finds no top-level
 * paragraph at the end. A Section compounds it: a document ending in one
 * opens with that Section's menu over the paragraph above, and the click
 * that would start the next line lands on the menu instead.
 */
const opener = ({ page, api, name }: Seeding) => async (what: string) =>
  openEditor(page, (await api.createTemplate({ title: name(what) })).id);

/** Every block the menu offers, in the order the menu offers it. */
const BLOCKS = [
  'Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Bullet List', 'Numbered List',
  'Image', 'Logo', 'Inline Image', 'Columns', 'Section', 'Repeat', 'Divider',
  'Spacer', 'Button', 'Link Card', 'Blockquote',
];
const COMPONENTS = ['Headers', 'Footers', 'Custom HTML'];

test.describe('editor on the desktop', () => {
  test('the block menu offers every block, in its group', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('slash roster') });
    await openEditor(page, t.id);
    await newLine(page);
    await page.keyboard.type('/');

    const menu = page.locator('#slash-command');
    await expect(menu).toBeVisible();
    await expect(menu.getByText('Blocks', { exact: true })).toBeVisible();
    await expect(menu.getByText('Components', { exact: true })).toBeVisible();
    for (const title of [...BLOCKS, ...COMPONENTS]) {
      await expect(slashRow(page, title), `${title} is offered`).toBeVisible();
    }
    await expect(menu.getByRole('button')).toHaveCount(BLOCKS.length + COMPONENTS.length);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('a block picked from the menu lands in the canvas', async ({ page, api, name }) => {
    // One representative per shape a customer can see: a heading, a list, a
    // wrapper, a rule, an atom with its own chrome, and a code block. The
    // catalogue's own contents are pinned by client/core/editor/block-catalogue.test.ts.
    const open = opener({ page, api, name });

    let pm = await open('heading');
    await insertViaSlash(page, 'Heading 2');
    await page.keyboard.type('A heading');
    await expect(pm.getByRole('heading', { level: 2 })).toHaveText('A heading');

    pm = await open('list');
    await insertViaSlash(page, 'Bullet List');
    await page.keyboard.type('An item');
    await expect(pm.getByRole('listitem')).toHaveText('An item');

    pm = await open('divider');
    await insertViaSlash(page, 'Divider');
    await expect(pm.getByRole('separator')).toHaveCount(1);

    pm = await open('section');
    await insertViaSlash(page, 'Section');
    await expect(pm.locator('table[data-type="section"]')).toHaveCount(1);

    pm = await open('columns');
    await insertViaSlash(page, 'Columns');
    await expect(pm.locator('div[data-type="columns"]')).toHaveCount(1);
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(2);

    pm = await open('button');
    await insertViaSlash(page, 'Button');
    await expect(pm.locator('[data-type="button"]').getByRole('button', { name: 'Button' })).toBeVisible();

    pm = await open('custom html');
    await insertViaSlash(page, 'Custom HTML');
    await expect(pm.locator('[data-type="htmlCodeBlock"]')).toHaveCount(1);
  });

  test('the block menu filters as the customer types', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('slash filter') });
    await openEditor(page, t.id);
    const menu = page.locator('#slash-command');

    await newLine(page);
    await page.keyboard.type('/head');
    await expect(slashRow(page, 'Heading 1')).toBeVisible();
    await expect(slashRow(page, 'Headers')).toBeVisible();
    await expect(slashRow(page, 'Divider')).toHaveCount(0);

    // A block is reachable by what it does, not only by its name. The query
    // is what sits between the `/` and the caret, so four Backspaces clear
    // `head` and leave the `/` — and the menu — in place.
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('loop');
    await expect(slashRow(page, 'Repeat')).toBeVisible();

    await page.keyboard.type('zzz');
    await expect(menu).toHaveCount(0);
    await expect(page.getByText('No result')).toBeVisible();
  });

  test('a sub-list offers pre-designed blocks and goes back', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('slash sub-list') });
    const pm = await openEditor(page, t.id);

    await newLine(page);
    await page.keyboard.type('/');
    await slashRow(page, 'Footers').click();
    // Choosing a sub-command inserts no block: it re-queries the menu, which
    // redraws with that group alone.
    for (const title of ['Footer Copyright', 'Footer Community Feedback CTA', 'Footer Company Signature']) {
      await expect(slashRow(page, title)).toBeVisible();
    }
    await expect(slashRow(page, 'Heading 1')).toHaveCount(0);

    // Leaving a sub-list restores the query that opened it, which a click
    // never recorded — so the way back from a clicked sub-list is the whole
    // menu rather than the `/foot` that might have narrowed it.
    await page.keyboard.press('ArrowLeft');
    await expect(slashRow(page, 'Heading 1')).toBeVisible();

    await slashRow(page, 'Footers').click();
    await slashRow(page, 'Footer Copyright').click();
    await expect(pm.getByText(`Temply © ${new Date().getFullYear()}. All rights reserved.`)).toBeVisible();
  });

  test('selecting text raises the menu that formats it', async ({ page, api, name }) => {
    // A document of many lines, worked on in the middle of it, which is the
    // shape a real one has. The Turn into popover is not portaled — by
    // design, so a heading cannot bleed its type into the form it opens — so
    // it is clipped by whatever clips the editor's pane, and it opens upwards
    // whenever the viewport has no room below. The one-line document a new
    // template starts with therefore puts its first rows above the canvas,
    // out of reach; the case below this one pins that. Twenty-four lines is
    // enough to clear the popover at the 1300×900 this project runs at, and
    // the assertion before the click is what says so rather than the count.
    const lines = Array.from({ length: 24 }, (_, i) => `Line ${i + 1}`);
    const content = JSON.stringify({
      type: 'doc',
      content: lines.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    });
    const t = await api.createTemplate({ title: name('text menu'), content });
    const pm = await openEditor(page, t.id);
    // Triple click is how a customer takes one paragraph; ControlOrMeta+A
    // would take the whole document and format every line of it.
    await pm.getByText('Line 12', { exact: true }).click({ clickCount: 3 });

    const menu = bubbleMenu(page, 'Bold');
    for (const control of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Code']) {
      await expect(menu.getByRole('button', { name: control, exact: true })).toBeVisible();
    }
    await expectOnScreen(page, menu, 'the text menu');

    await menu.getByRole('button', { name: 'Bold', exact: true }).click();
    await expect(pm.locator('strong')).toHaveText('Line 12');

    // Turn into has no accessible name — it is the menu's first control, and
    // its popover is the only one holding "Heading 1".
    await menu.getByRole('button').first().click();
    const turnInto = menu.getByRole('dialog').filter({ hasText: 'Heading 1' });
    await expectOnScreen(page, turnInto, 'the Turn into popover');
    const canvasBox = (await pm.boundingBox())!;
    const popover = (await turnInto.boundingBox())!;
    expect(popover.y, 'the popover opens inside the canvas, where all of its rows can be clicked')
      .toBeGreaterThanOrEqual(canvasBox.y);
    await turnInto.getByRole('button', { name: 'Heading 1', exact: true }).click();
    await expect(pm.locator('h1')).toHaveText('Line 12');
  });

  test('on a one-line template the Turn into popover opens above the canvas', async ({ page, api, name }) => {
    // Characterisation, not a wish: this pins the product as it stands. A new
    // template is one line, so this is the first Turn into any customer
    // opens, and the popover — inline rather than portaled, flipped upwards
    // because the viewport has no room below — lands above the canvas with
    // Paragraph, Heading 1 and Heading 2 clipped out of reach. The assertion
    // below is true only while that is true. When it goes red the product has
    // improved: rewrite this case as the reachability one above, and drop the
    // twenty-four-line seed that case needs.
    const t = await api.createTemplate({ title: name('clipped') });
    const pm = await openEditor(page, t.id);
    await pm.getByText('Hello from e2e').click({ clickCount: 3 });

    const menu = bubbleMenu(page, 'Bold');
    await menu.getByRole('button').first().click();
    const turnInto = menu.getByRole('dialog').filter({ hasText: 'Heading 1' });
    await expectOnScreen(page, turnInto, 'the Turn into popover');

    const canvasBox = (await canvas(page).boundingBox())!;
    const popover = (await turnInto.boundingBox())!;
    expect(popover.y, 'the popover still opens above the canvas, with its top rows out of reach')
      .toBeLessThan(canvasBox.y);
  });

  test('the spacer, section and columns menus open their popups on screen', async ({ page, api, name }) => {
    const open = opener({ page, api, name });

    // Spacer: a menu of five sizes and nothing else to open. The height it
    // stores is what says a size landed.
    let pm = await open('spacer');
    await insertViaSlash(page, 'Spacer');
    const spacer = bubbleMenu(page, 'md');
    await expectOnScreen(page, spacer, 'the spacer menu');
    await spacer.getByRole('button', { name: 'xl', exact: true }).click();
    await expect(pm.locator('div[data-maily-component="spacer"]')).toHaveAttribute('data-height', '64');

    // Section: a menu with named selects, a named delete, and colour popups.
    pm = await open('section');
    await insertViaSlash(page, 'Section');
    const section = bubbleMenu(page, 'Delete Section');
    await expectOnScreen(page, section, 'the section menu');
    await section.getByRole('button', { name: 'Padding' }).click();
    await expectOnScreen(page, page.getByRole('menu'), 'the Padding menu');
    await page.keyboard.press('Escape');

    // Columns: the widths popup is the one that can overflow the pane. The
    // menu belongs to a column and a fresh Columns leaves the wrapper
    // selected instead, so the typed character below is the way in; the case
    // after this one pins why.
    pm = await open('columns');
    await insertViaSlash(page, 'Columns');
    await page.keyboard.type('Left');
    await expect(pm.locator('div[data-type="column"]').first()).toHaveText('Left');
    const columns = bubbleMenu(page, 'Columns and widths');
    await expectOnScreen(page, columns, 'the columns menu');
    await columns.getByRole('button', { name: 'Columns and widths' }).click();
    const widths = columns.getByRole('dialog').filter({ hasText: '2 Columns' });
    await expectOnScreen(page, widths, 'the Columns and widths popover');
    await widths.getByRole('button', { name: '3 Columns' }).click();
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(3);
  });

  test('a freshly inserted Columns carries no menu until a character is typed', async ({ page, api, name }) => {
    // Characterisation, not a wish: this pins the product as it stands. The
    // insert leaves a node selection on the columns wrapper, which
    // `isTextSelected` reads as a text selection — so the columns menu hides,
    // and the text menu hides too because the selected node is a nested one.
    // The block a customer just asked for offers nothing at all, and a click
    // on an empty column does not move the caret either. When the first
    // assertion goes red the product has improved: rewrite this case as the
    // click that a customer would make, and drop the typed character the case
    // above needs.
    const t = await api.createTemplate({ title: name('no menu') });
    const pm = await openEditor(page, t.id);
    await insertViaSlash(page, 'Columns');
    // The block is asserted rendered before the absence below, so the count
    // cannot pass on a menu that has merely not been drawn yet: a bubble menu
    // is raised by the same transaction that puts these columns on screen.
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(2);
    await expect(page.locator('.tippy-box'), 'the fresh Columns still raises no menu of any kind').toHaveCount(0);

    await page.keyboard.type('Left');
    await expect(pm.locator('div[data-type="column"]').first()).toHaveText('Left');
    await expectOnScreen(page, bubbleMenu(page, 'Columns and widths'), 'the columns menu');
  });
});
