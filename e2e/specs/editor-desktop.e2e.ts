import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import type { makeApi } from '../fixtures/api';
import { bubbleMenu, docOf, expectOnScreen, insertHere, insertViaSlash, newLine, openEditor, slashRow } from '../fixtures/canvas';

// The canvas is a contenteditable, so ProseMirror's own class names stand in
// for roles it does not give, and a node view's `data-type` stands in for
// what a block is. A Spacer carries no `data-type` at all — it is a band of
// nothing — so its own `data-maily-component` is what says it is one. A live
// variable pill carries no attribute of its own either: `@tiptap/react`
// builds the node view's outer element itself and puts nothing on it but the
// class `node-variable`, so that class is the pill. `data-show-if-key` is the
// one attribute a conditional block does carry in the canvas — paragraphs,
// headings and Sections have no node view, so their `renderHTML` is the
// canvas DOM and the condition is readable there. A Repeat's preview rows
// are `.mly-repeat-copy`: they are a picture of repetition rather than more
// places to type, so they are `aria-hidden` by design and a class is all
// that is left to count them by. `[data-repeat-indicator]` is the strip in
// the margin — a `role="button"`, but the attribute is what tells it apart
// from every other button in the canvas. `.ProseMirror-selectednode` is the
// mark ProseMirror puts on a block taken whole: a node selection is a state
// of the document rather than of the DOM, and nothing else says it happened.
// `#slash-command` and `.tippy-box` are the two other exceptions this file
// needs, both explained where they are used. Outside the canvas there is one
// more: the cheatsheet's keys are `kbd` elements carrying neither a role nor
// a name, so the element itself is what a case counts and reads.

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

  test('on a one-line template the Turn into rows a customer wants cannot be pressed', async ({ page, api, name }) => {
    // Characterisation, not a wish: this pins the product as it stands. A new
    // template is one line, so this is the first Turn into any customer
    // opens. The popover is rendered inline rather than portaled and flips
    // upwards because the viewport has no room below, which puts its top rows
    // — Paragraph, Heading 1, Heading 2 — outside the editor pane, and the
    // pane clips them: the Content card is `overflow-hidden`, and it starts
    // well above the canvas, behind the header and the preflight panel.
    //
    // What is asserted is what sits on top at the point a customer would
    // press, not where the popup sits: geometry alone cannot tell the two
    // apart, since a popover positioned exactly here is perfectly usable once
    // nothing clips it. When this goes red the product has improved — the row
    // can be pressed — so rewrite this case as the reachability one above and
    // drop the twenty-four-line seed that case needs.
    const t = await api.createTemplate({ title: name('clipped') });
    const pm = await openEditor(page, t.id);
    await pm.getByText('Hello from e2e').click({ clickCount: 3 });

    const menu = bubbleMenu(page, 'Bold');
    await menu.getByRole('button').first().click();
    const turnInto = menu.getByRole('dialog').filter({ hasText: 'Heading 1' });
    await expectOnScreen(page, turnInto, 'the Turn into popover');

    const row = (await turnInto.getByRole('button', { name: 'Heading 1', exact: true }).boundingBox())!;
    const reachable = await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('[role="dialog"]'),
      [row.x + row.width / 2, row.y + row.height / 2] as [number, number]
    );
    expect(reachable, 'the Heading 1 row is still covered: the point over it belongs to something outside the popover')
      .toBe(false);
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
    // menu belongs to a column and the insert leaves the caret between them,
    // so the typed character below is the way in; the case after this one
    // pins why.
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
    // Columns command in client/core/blocks/layout.tsx ends
    // `.focus(editor.state.selection.head - 2)`, and that argument is read
    // when the chain is built — before `deleteRange` and `setColumns` have
    // run — so it aims at a position in the document as it was before the
    // insert. The caret lands between the two columns rather than in one, and
    // `editor.isActive('columns')` is false there, so the columns menu does
    // not show; the text menu does not either, the selection being empty. The
    // block a customer just asked for offers nothing at all. Neither Section
    // nor Repeat carries that argument, and both do put the caret inside what
    // they made.
    //
    // The caret is what is asserted, not the absent menu: the bubble-menu
    // plugin debounces a non-empty selection by 250 ms, so a count taken at
    // once would still read zero on a fix that raised the menu a quarter of a
    // second later. When the caret assertion goes red the product has
    // improved: rewrite this case as the click a customer would make, and
    // drop the typed character the case above needs.
    const t = await api.createTemplate({ title: name('no menu') });
    const pm = await openEditor(page, t.id);
    await insertViaSlash(page, 'Columns');
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(2);

    const caret = await page.evaluate(() => {
      const node = window.getSelection()?.anchorNode;
      const el = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
      return el?.closest('[data-type="column"]') ? 'in a column' : 'outside every column';
    });
    expect(caret, 'the insert still leaves the caret between the columns rather than inside one')
      .toBe('outside every column');
    // The slash panel is a tippy of its own, so it is excluded rather than
    // relied on having been torn down by now.
    const floating = page.locator('.tippy-box').filter({ hasNot: page.locator('#slash-command') });
    await expect(floating, 'the fresh Columns raises no menu of any kind').toHaveCount(0);

    await page.keyboard.type('Left');
    await expect(pm.locator('div[data-type="column"]').first()).toHaveText('Left');
    await expectOnScreen(page, bubbleMenu(page, 'Columns and widths'), 'the columns menu');
  });

  test('a Repeat names its list and previews it', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('repeat') });
    const pm = await openEditor(page, t.id);
    await insertViaSlash(page, 'Repeat');

    const repeat = pm.locator('[data-type="repeat"]');
    await expect(repeat).toHaveCount(1);
    // Two rows is the default for a list nobody has named yet: the live row
    // plus one shadow copy.
    await expect(repeat.locator('.mly-repeat-copy')).toHaveCount(1);
    const indicator = pm.locator('[data-repeat-indicator]');
    await expect(indicator).toHaveAccessibleName('×2');

    await indicator.click();
    const menu = bubbleMenu(page, 'About Repeat');
    await expectOnScreen(page, menu, 'the repeat menu');
    await menu.getByRole('button', { name: 'items', exact: true }).click();
    await menu.getByPlaceholder('ie. payload.items').fill('orders');
    await page.keyboard.press('Enter');
    await expect.poll(async () => JSON.stringify(await docOf(api, t.id)).includes('"each":"orders"'),
      { message: 'the saved Repeat names the list it walks' }).toBe(true);

    await menu.getByRole('button', { name: 'More preview rows' }).click();
    await expect(repeat.locator('.mly-repeat-copy')).toHaveCount(2);
    await expect(indicator).toHaveAccessibleName('×3');

    // The same number is what the sample-data panel offers, because the count
    // is one state shared between the canvas and the panel.
    await page.getByRole('group', { name: 'Content view' }).getByRole('button', { name: 'Preview', exact: true }).click();
    await page.getByRole('button', { name: 'Preview data' }).click();
    await expect(page.getByRole('dialog').filter({ hasText: 'Preview data' }).getByText('3 items')).toBeVisible();
  });

  test('a Columns inside a Section is reached through the Section menu', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('nested columns') });
    const pm = await openEditor(page, t.id);
    await insertViaSlash(page, 'Section');
    await pm.locator('table[data-type="section"] p').first().click();
    await insertHere(page, 'Columns');
    // The typed character is the way into a fresh Columns wherever it is
    // built, for the stale-focus reason the case above pins: the caret lands
    // between the two columns, and a click on a column's empty paragraph is
    // not a way back in — it leaves the selection on the section cell, so the
    // Section menu never learns a Columns is active. Typing goes to the first
    // column all the same. The focus check is what says the keystroke will
    // reach the document rather than the row that is going away.
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(2);
    await expect(pm).toBeFocused();
    await page.keyboard.type('Left');
    await expect(pm.locator('div[data-type="column"]').first()).toHaveText('Left');

    const section = bubbleMenu(page, 'Delete Section');
    await expect(section).toBeVisible();
    // The Columns menu stands down inside a Section; its controls move into
    // the Section menu behind a button that says which they are.
    await expect(bubbleMenu(page, 'Columns and widths')).toHaveCount(0);
    const column = section.getByRole('button', { name: 'Column', exact: true });
    await expect(column).toBeVisible();
    await column.click();
    // Named by what it holds rather than by its words: the Columns menu's
    // controls are icons, so the only text in this popover is the labels of
    // the selects, which the Section menu's own popovers share.
    const inside = section.getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Columns and widths' }) });
    await expectOnScreen(page, inside, 'the Column popover');
    await expect(inside.getByRole('button', { name: 'Delete Columns' })).toBeVisible();
  });

  test('a Section inside a Repeat keeps both menus, out of each other’s way', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('nested section') });
    const pm = await openEditor(page, t.id);
    await insertViaSlash(page, 'Repeat');
    // A Repeat holds two paragraphs at rest, the live row and the serialised
    // copy under it, so the first in document order is the one to type in.
    await pm.locator('[data-type="repeat"] p').first().click();
    await insertHere(page, 'Section');
    await pm.locator('table[data-type="section"] p').first().click();

    const repeatMenu = bubbleMenu(page, 'About Repeat');
    const sectionMenu = bubbleMenu(page, 'Delete Section');
    await expectOnScreen(page, repeatMenu, 'the repeat menu');
    await expectOnScreen(page, sectionMenu, 'the section menu');
    // Which one moves is not a toss-up. Each menu asks whether a nested
    // block of the other kind, among its own children, is the active one:
    // the Repeat holds the Section and the Section is where the caret is, so
    // the Repeat goes below; the Section asks after a Repeat child of its
    // own, has none, and keeps the spot above. The pair is asserted rather
    // than the presence of a `bottom`, because two `bottom`s — what a rule
    // broadened to "inside a Repeat" would give — is the two menus back on
    // top of each other, which is the failure this case is named for.
    const placements = [await repeatMenu.getAttribute('data-placement'), await sectionMenu.getAttribute('data-placement')];
    expect(placements, 'the Repeat menu moves below and the Section menu keeps the spot above').toEqual(['bottom', 'top']);

    // And what the placement is for: the boxes do not cover each other.
    const repeatBox = (await repeatMenu.boundingBox())!;
    const sectionBox = (await sectionMenu.boundingBox())!;
    const overlaps =
      repeatBox.x < sectionBox.x + sectionBox.width && sectionBox.x < repeatBox.x + repeatBox.width &&
      repeatBox.y < sectionBox.y + sectionBox.height && sectionBox.y < repeatBox.y + repeatBox.height;
    expect(overlaps, 'neither menu covers the other').toBe(false);
  });

  test('a variable pill is named, renamed and given a placeholder', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('variable') });
    const pm = await openEditor(page, t.id);
    await pm.getByText('Hello from e2e').click();
    await page.keyboard.press('End');
    // `@` opens the panel under the same rule as `/` — start of a textblock
    // or after a space — so the space is part of the way in.
    await page.keyboard.type(' @');
    await page.keyboard.type('first_name');

    // The panel is a tippy of its own, headed "Variables", and a name the
    // app does not know yet is offered as a row of its own so the first use
    // of a variable is what names it. Waiting for that row is what makes
    // Enter pick it rather than break the line: the panel is rendered a
    // frame after the keystroke that queries it.
    const suggestions = page.locator('.tippy-box').filter({ hasText: 'Variables' });
    await expect(suggestions.getByRole('button', { name: 'first_name', exact: true })).toBeVisible();
    await page.keyboard.press('Enter');

    const pill = pm.locator('.node-variable');
    await expect(pill).toHaveCount(1);
    await expect(pill).toContainText('first_name');

    // The pill's own popover: click it, and the two fields are the whole of
    // what a customer can say about a variable. Clicking opens that popover
    // and, because the pill's node view flags it open, keeps the variable
    // bubble menu — which offers the same two fields — from raising over it.
    await pill.click();
    const fields = page.getByRole('dialog').filter({ has: page.getByRole('textbox', { name: 'Variable' }) });
    await expectOnScreen(page, fields, 'the variable popover');
    await fields.getByRole('textbox', { name: 'Variable' }).fill('given_name');
    await fields.getByRole('textbox', { name: 'Placeholder' }).fill('there');
    await page.keyboard.press('Escape');
    await expect(pill).toContainText('given_name');

    await expect.poll(async () => {
      const doc = await docOf(api, t.id);
      return JSON.stringify(doc).includes('"id":"given_name"') && JSON.stringify(doc).includes('"fallback":"there"');
    }, { message: 'the saved document holds the renamed pill and its placeholder' }).toBe(true);
  });

  test('Show if puts a condition on a block and takes it off', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('show if') });
    const pm = await openEditor(page, t.id);
    await pm.getByText('Hello from e2e').click();
    await page.keyboard.press('ControlOrMeta+A');

    // The eye has no accessible name; it is the menu's last control, and it
    // renders only for a paragraph or a heading. Its dialog is the only one
    // that holds the words "Show if" and a field placeheld "e.g. isMember".
    // The locator is read again for the second press, by which time the
    // popover has closed and given the last place back.
    const menu = bubbleMenu(page, 'Bold');
    const eye = menu.getByRole('button').last();
    await eye.click();
    const dialog = menu.getByRole('dialog').filter({ hasText: 'Show if' });
    await expectOnScreen(page, dialog, 'the Show if popover');
    await dialog.getByPlaceholder('e.g. isMember').fill('isMember');
    await page.keyboard.press('Enter');

    // The condition is on the block the moment it is typed, and the canvas
    // says so through the paragraph's own attribute. `.mly-show-if-highlight`
    // is not that marker: it outlines every block sharing a key only while a
    // suggestion is under the pointer, and it is cleared when the popover
    // closes — so a block that carries a condition looks, at rest, like one
    // that does not.
    await expect(pm.locator('p[data-show-if-key="isMember"]')).toHaveCount(1);
    await expect.poll(async () => JSON.stringify(await docOf(api, t.id)).includes('"showIfKey":"isMember"'),
      { message: 'the saved block carries the condition' }).toBe(true);

    // Emptying the field is what takes the condition off, and Escape is what
    // a customer leaves by. Enter cannot be used here: with the field empty
    // the panel still offers the key already in the document, and Enter picks
    // the highlighted row — putting the condition straight back.
    await eye.click();
    await dialog.getByPlaceholder('e.g. isMember').fill('');
    await page.keyboard.press('Escape');
    await expect(pm.locator('p[data-show-if-key]')).toHaveCount(0);
    await expect.poll(async () => JSON.stringify(await docOf(api, t.id)).includes('"showIfKey":"isMember"'),
      { message: 'the saved block no longer carries the condition' }).toBe(false);
  });

  test('the cheatsheet lists what the editor answers to', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('cheatsheet') });
    await openEditor(page, t.id);
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(sheet).toBeVisible();
    // The group titles are uppercased in CSS, and an accessible name follows
    // `text-transform`, so the case is what gives way: the anchors are what
    // keep "Text" from answering for a heading that merely starts with it.
    for (const group of ['Insert', 'Write', 'Blocks', 'Text']) {
      await expect(sheet.getByRole('heading', { name: new RegExp(`^${group}$`, 'i') })).toBeVisible();
    }

    // The keys are rewritten for the platform the reader is on, and they are
    // invisible until that resolves — so the text is the wait, and the whole
    // list in order is what is waited for. A key looked up on its own would
    // not do: a substring match lets `- ` answer to the `---` row.
    //
    // Which set is on screen is the browser's platform, not the host's. This
    // project runs Playwright's Desktop Chrome descriptor, which reports a
    // platform of its own, so a Mac running the suite still reads the Ctrl
    // keys; `process.platform` would ask the wrong machine.
    const mac = await page.evaluate(() => {
      const hinted = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
      return /mac|iphone|ipad|ipod/i.test(hinted?.platform || navigator.platform || navigator.userAgent || '');
    });
    const keys = mac
      ? ['/', '@', '---', '# ', '- ', '1. ', '> ', '**text**', '⇧Enter', '⌘⇧↑', '⌘⇧↓', '⌘⇧D', '⌘⇧Space', '⌘⇧⌫', '⌘B', '⌘I', '⌘U', '⌘Z']
      : ['/', '@', '---', '# ', '- ', '1. ', '> ', '**text**', 'Shift+Enter', 'Ctrl+Shift+↑', 'Ctrl+Shift+↓', 'Ctrl+Shift+D', 'Ctrl+Shift+Space', 'Ctrl+Shift+Backspace', 'Ctrl+B', 'Ctrl+I', 'Ctrl+U', 'Ctrl+Z'];
    await expect(sheet.locator('kbd'), 'every shortcut is listed, in its group and in order').toHaveText(keys);

    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
    // The sheet answers to its own shortcut too.
    await page.keyboard.press('ControlOrMeta+/');
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('the shortcuts the cheatsheet lists do what it says', async ({ page, api, name }) => {
    // A template per case, the way the block cases further up take one.
    // Two cases cannot share a document: `newLine` is the only way to a
    // fresh top-level line — which every case needs, an input rule having to
    // start a textblock and a Blocks shortcut reaching only the top-level
    // block the caret is in — and it asks that the new line be the
    // document's last block, which the divider, list or quote the case
    // before left there makes impossible; TrailingNode is not registered, so
    // nothing puts a paragraph after them. Clicking a line further up
    // instead is no way round it: a click moves the browser's selection at
    // once and the editor's own a tick later, and a key pressed in between
    // is dealt with where the editor still believes the caret is — the end
    // of the document, where the canvas opened. On a fresh template that is
    // the line `newLine` clicks, which is why this pattern is the safe one.
    const open = opener({ page, api, name });

    // Insert: the two characters that open a panel.
    await open('slash');
    await newLine(page);
    await page.keyboard.type('/');
    await expect(page.locator('#slash-command')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#slash-command')).toBeHidden();

    await open('variable');
    await newLine(page);
    await page.keyboard.type('@');
    const variables = page.locator('.tippy-box').filter({ hasText: 'Variables' });
    await expect(variables).toBeVisible();
    // Backspace rather than Escape: taking the `@` away is what ends the
    // query, and the panel goes with it.
    await page.keyboard.press('Backspace');
    await expect(variables).toBeHidden();

    // Insert and Write: the markdown-style inputs, typed as the cheatsheet
    // writes them. The divider is the one that carries no trailing space —
    // its rule fires on the third dash.
    let pm = await open('divider');
    await newLine(page);
    await page.keyboard.type('---');
    await expect(pm.locator('hr')).toHaveCount(1);

    pm = await open('heading');
    await newLine(page);
    await page.keyboard.type('# A heading');
    await expect(pm.locator('h1')).toHaveText('A heading');

    pm = await open('bullet list');
    await newLine(page);
    await page.keyboard.type('- An item');
    await expect(pm.locator('ul > li')).toHaveText('An item');

    pm = await open('numbered list');
    await newLine(page);
    await page.keyboard.type('1. First');
    await expect(pm.locator('ol > li')).toHaveText('First');

    pm = await open('blockquote');
    await newLine(page);
    await page.keyboard.type('> A quote');
    await expect(pm.locator('blockquote')).toContainText('A quote');

    pm = await open('bold markdown');
    await newLine(page);
    await page.keyboard.type('**bold**');
    await expect(pm.locator('strong')).toHaveText('bold');

    pm = await open('line break');
    await newLine(page);
    await page.keyboard.type('one');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('two');
    await expect(pm.locator('> p').filter({ hasText: /^onetwo$/ }).locator('br')).toHaveCount(1);

    // Text: the marks. Triple click is how a customer takes one paragraph;
    // ControlOrMeta+A would take the whole document and mark every line of
    // it, which these assertions could not tell from a working shortcut.
    pm = await open('marks');
    await newLine(page);
    await page.keyboard.type('marked');
    const marked = pm.locator('> p').filter({ hasText: /^marked$/ });
    await marked.click({ clickCount: 3 });
    // The menu raises on a range the editor has taken into its own state, so
    // waiting for it is what says the selection is there to be marked.
    await expect(bubbleMenu(page, 'Bold')).toBeVisible();
    await page.keyboard.press('ControlOrMeta+B');
    await expect(marked.locator('strong')).toHaveText('marked');
    await page.keyboard.press('ControlOrMeta+I');
    await expect(marked.locator('em')).toHaveText('marked');
    await page.keyboard.press('ControlOrMeta+U');
    await expect(marked.locator('u')).toHaveText('marked');
    await page.keyboard.press('ControlOrMeta+Z');
    // The line surviving is what says undo took the mark off rather than the
    // typing with it.
    await expect(marked).toHaveCount(1);
    await expect(marked.locator('u')).toHaveCount(0);

    // Blocks: the move, asserted as order. A block that moves onto its own
    // duplicate reads the same either way, so the two lines are told apart.
    pm = await open('move a block');
    await newLine(page);
    await page.keyboard.type('upper');
    await page.keyboard.press('Enter');
    await page.keyboard.type('lower');
    const pair = pm.locator('> p').filter({ hasText: /^(upper|lower)$/ });
    await expect(pair).toHaveText(['upper', 'lower']);
    await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
    await expect(pair, 'the block swaps with the one above').toHaveText(['lower', 'upper']);
    await page.keyboard.press('ControlOrMeta+Shift+ArrowDown');
    await expect(pair, 'and swaps back with the one below').toHaveText(['upper', 'lower']);

    // Blocks: the selection, the copy and the delete.
    pm = await open('select a block');
    await newLine(page);
    await page.keyboard.type('movable');
    const movable = pm.getByText('movable', { exact: true });
    await page.keyboard.press('ControlOrMeta+Shift+Space');
    await expect(pm.locator('.ProseMirror-selectednode')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+Shift+D');
    await expect(movable).toHaveCount(2);
    await page.keyboard.press('ControlOrMeta+Shift+Backspace');
    await expect(movable).toHaveCount(1);
  });
});
