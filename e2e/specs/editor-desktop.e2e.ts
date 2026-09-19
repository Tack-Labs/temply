import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import type { makeApi } from '../fixtures/api';
import { bubbleMenu, docOf, expectOnScreen, insertHere, insertViaSlash, newLine, openEditor, slashMenu, slashRow } from '../fixtures/canvas';

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
// `.tippy-box` is the one other exception this file needs, explained where
// it is used. Outside the canvas there is one
// more: the cheatsheet's keys are `kbd` elements carrying neither a role nor
// a name, so the element itself is what a case counts and reads. The
// sanctioned list, and what would retire each hook, is in e2e/README.md.
//
// What this file covers of the bubble menus: the text menu and its Turn into
// and Show if popovers, the spacer, section, columns, column, repeat and
// image menus, and the variable pill's own popover. The HTML menu's own
// controls and the inline-image menu are asserted nowhere here; they are Plan
// 4's scope.

/** What a test hands the opener below: its own page and its own seeding. */
type Seeding = { page: Page; api: ReturnType<typeof makeApi>; name: (what: string) => string };

/**
 * A fresh template of its own, open in the editor, per block a test needs.
 *
 * One document would carry several inserts, but a template each is what keeps
 * a block from being read off the wrong one: a bubble menu is asked for by
 * the control it holds, and two Sections in one document would both answer to
 * that.
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

    const menu = slashMenu(page);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('group', { name: 'Blocks' })).toBeVisible();
    await expect(menu.getByRole('group', { name: 'Components' })).toBeVisible();
    for (const title of [...BLOCKS, ...COMPONENTS]) {
      await expect(slashRow(page, title), `${title} is offered`).toBeVisible();
    }
    await expect(menu.getByRole('option')).toHaveCount(BLOCKS.length + COMPONENTS.length);
    // The row a keystroke would take is named to the reader rather than
    // focused: the caret stays in the canvas, so nothing else could say it.
    await expect(menu).toHaveAttribute('aria-activedescendant', 'slash-command-0-0');
    await expect(slashRow(page, BLOCKS[0]!)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveAttribute('aria-activedescendant', 'slash-command-0-1');
    await expect(slashRow(page, BLOCKS[1]!)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('a block picked from the menu lands in the canvas', async ({ page, api, name }) => {
    // Seven fresh templates, each a create call and a cold editor render, on
    // a CI runner that already needs `expect.timeout` at 10 s. The default
    // 30 s covers it locally and not there, and the budget is the only thing
    // missing — the per-template pattern is what keeps the blocks from
    // nesting inside each other.
    test.slow();
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

  test('the code-block shortcut leaves a template that still renders', async ({ page, api, name }) => {
    // StarterKit's own code block was registered under this keystroke and the
    // renderer had no case for it, so one press turned a template into one
    // that could not be previewed, preflighted, published or sent — with the
    // canvas still accepting edits as though nothing had happened. The block
    // the keystroke builds now is Temply's own, and the preview rendering is
    // what says the template is still sendable.
    const t = await api.createTemplate({ title: name('code shortcut') });
    const pm = await openEditor(page, t.id);

    await newLine(page);
    await page.keyboard.press('ControlOrMeta+Alt+C');
    await expect(pm.locator('[data-type="htmlCodeBlock"]')).toHaveCount(1);
    await page.keyboard.type('<b>Still sendable</b>');

    await page.getByRole('group', { name: 'Content view' }).getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.getByTitle('Email preview').contentFrame();
    await expect(preview.getByText('Still sendable')).toBeVisible();
  });

  test('a template stored with the old code block opens and still renders', async ({ page, api, name }) => {
    // The rows written while that shortcut built StarterKit's block are the
    // other half of the same bug, and the worse half: tiptap does not drop a
    // node the schema has stopped admitting, it falls back to an empty
    // document — so the canvas would open blank and the first keystroke would
    // save the blank over the template. The paragraphs around the block are
    // what say the document survived.
    //
    // The card thumbnail is read first and deliberately: it renders the row
    // as stored, so it is the engine's own alias under test and not the
    // editor's migration a second time. The preview pane could not do that
    // job — it posts the document the canvas holds, which has already been
    // through the migration — and reading the thumbnail before the editor
    // opens is what keeps an autosave from rewriting the row underneath it.
    const content = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Above the block' }] },
        { type: 'codeBlock', attrs: { language: 'html' }, content: [{ type: 'text', text: '<b>Stored code</b>' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Below the block' }] },
      ],
    });
    const t = await api.createTemplate({ title: name('stored code block'), content });

    expect(await api.previewHtml(t.id), 'the engine draws the row as stored').toContain('<b>Stored code</b>');

    const pm = await openEditor(page, t.id);
    await expect(pm.getByText('Above the block')).toBeVisible();
    await expect(pm.getByText('Below the block')).toBeVisible();
    await expect(pm.locator('[data-type="htmlCodeBlock"]')).toHaveCount(1);
  });

  test('the block menu filters as the customer types', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('slash filter') });
    await openEditor(page, t.id);
    const menu = slashMenu(page);

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
    // What stands in its place is a status, not an empty list of choices,
    // and it is named so a reader knows which panel is speaking.
    await expect(page.getByRole('status', { name: 'Block menu' })).toHaveText('No block matches');
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
    // shape a real one has — the one-line shape every new template starts
    // from is the case below. The Turn into popover stays inside the menu
    // rather than being portaled, by design, so a heading cannot bleed its
    // type into the form it opens; the menu itself hangs off the page rather
    // than off the editor's pane, so nothing clips the popover wherever the
    // room runs out and it flips.
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

    const menu = bubbleMenu(page, 'Text formatting');
    // Every control the menu offers, by the name a screen reader reads. Most
    // of these are an icon and a tooltip, and a tooltip is `aria-describedby`
    // — so until the tooltip became the name as well, this list was five
    // buttons and seven anonymous ones.
    for (const control of [
      'Turn into', 'Bold', 'Italic', 'Underline', 'Strikethrough', 'Code',
      'Alignment', 'Text direction', 'Bullet list', 'Numbered list',
      'Link address', 'Text colour',
    ]) {
      await expect(menu.getByRole('button', { name: control, exact: true }),
        `${control} is named`).toBeVisible();
    }
    await expectOnScreen(page, menu, 'the text menu');

    await menu.getByRole('button', { name: 'Bold', exact: true }).click();
    await expect(pm.locator('strong')).toHaveText('Line 12');

    await menu.getByRole('button', { name: 'Turn into', exact: true }).click();
    const turnInto = menu.getByRole('dialog', { name: 'Turn into' });
    await expectOnScreen(page, turnInto, 'the Turn into popover');
    await turnInto.getByRole('button', { name: 'Heading 1', exact: true }).click();
    await expect(pm.locator('h1')).toHaveText('Line 12');
  });

  test('on a one-line template the Turn into rows a customer wants can be pressed', async ({ page, api, name }) => {
    // A new template is one line, so this is the first Turn into any
    // customer opens, and the hardest place to put one: there is no room
    // below the menu, so the popover flips upwards and its top rows —
    // Paragraph, Heading 1, Heading 2 — land above the canvas, where the
    // Content card's `overflow-hidden` reaches. Nothing there may clip it.
    //
    // What is asserted is what sits on top at the point a customer would
    // press, not where the popup sits: geometry alone cannot tell the two
    // apart, since a popover positioned exactly here reads as fine while a
    // pane is clipping it. The click after it is the proof twice over —
    // Playwright will not press an element something else is covering.
    const t = await api.createTemplate({ title: name('one line') });
    const pm = await openEditor(page, t.id);
    await pm.getByText('Hello from e2e').click({ clickCount: 3 });

    const menu = bubbleMenu(page, 'Text formatting');
    await menu.getByRole('button', { name: 'Turn into', exact: true }).click();
    const turnInto = menu.getByRole('dialog', { name: 'Turn into' });
    await expectOnScreen(page, turnInto, 'the Turn into popover');

    const row = (await turnInto.getByRole('button', { name: 'Heading 1', exact: true }).boundingBox())!;
    const reachable = await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('[role="dialog"]'),
      [row.x + row.width / 2, row.y + row.height / 2] as [number, number]
    );
    expect(reachable, 'the point over the Heading 1 row belongs to the popover, so a click there reaches it')
      .toBe(true);
    await turnInto.getByRole('button', { name: 'Heading 1', exact: true }).click();
    await expect(pm.locator('h1')).toHaveText('Hello from e2e');
  });

  test('the spacer, section and columns menus open their popups on screen', async ({ page, api, name }) => {
    const open = opener({ page, api, name });

    // Spacer: a menu of five sizes and nothing else to open. The height it
    // stores is what says a size landed.
    let pm = await open('spacer');
    await insertViaSlash(page, 'Spacer');
    const spacer = bubbleMenu(page, 'Spacer');
    await expectOnScreen(page, spacer, 'the spacer menu');
    await spacer.getByRole('button', { name: 'xl', exact: true }).click();
    await expect(pm.locator('div[data-maily-component="spacer"]')).toHaveAttribute('data-height', '64');

    // Section: a menu with named selects, a named delete, and colour popups.
    pm = await open('section');
    await insertViaSlash(page, 'Section');
    const section = bubbleMenu(page, 'Section');
    await expectOnScreen(page, section, 'the section menu');
    await section.getByRole('button', { name: 'Padding' }).click();
    await expectOnScreen(page, page.getByRole('menu'), 'the Padding menu');
    // Escape closes the popup it was aimed at and nothing behind it: the menu
    // holding the control has to still be there to use.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu'), 'Escape closes the Padding menu').toBeHidden();
    await expectOnScreen(page, section, 'the section menu after the Padding menu closes');

    // Columns: the widths popup is the one that can overflow the pane. The
    // insert leaves the caret in the first column, so the menu is up without
    // anything being typed into it; the case after this one pins that.
    pm = await open('columns');
    await insertViaSlash(page, 'Columns');
    const columns = bubbleMenu(page, 'Columns');
    await expectOnScreen(page, columns, 'the columns menu');
    await columns.getByRole('button', { name: 'Columns and widths' }).click();
    const widths = columns.getByRole('dialog', { name: 'Columns and widths' });
    await expectOnScreen(page, widths, 'the Columns and widths popover');
    await widths.getByRole('button', { name: '3 Columns' }).click();
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(3);
  });

  test('a Logo carries the image menu, and its alt text is saved', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('logo') });
    await openEditor(page, t.id);
    await insertViaSlash(page, 'Logo');

    // The image menu serves Logo and Image from one file, and which controls
    // it renders is the block plus its state: `Size` belongs to a Logo and
    // appears only once one has a source, `Link address` and `Border radius`
    // only to an Image. A Logo a customer has just asked for has neither a
    // source nor a picture, so what follows is the whole of what it offers.
    const menu = bubbleMenu(page, 'Image');
    await expectOnScreen(page, menu, 'the image menu');
    for (const control of ['Alignment', 'Image source', 'Alt text', 'Show block conditionally']) {
      await expect(menu.getByRole('button', { name: control, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole('button', { name: 'Size', exact: true })).toHaveCount(0);

    // Alt text is the control that matters most on this block: a mail client
    // that blocks the image shows it in the image's place, so it is the only
    // thing a recipient with images off reads. Enter submits the form and
    // closes the popover, which is what commits the value.
    await menu.getByRole('button', { name: 'Alt text', exact: true }).click();
    const alt = menu.getByRole('dialog', { name: 'Alt text' });
    await expectOnScreen(page, alt, 'the Alt text popover');
    await alt.getByRole('textbox', { name: 'Alt text' }).fill('The company mark');
    await page.keyboard.press('Enter');
    await expect.poll(async () => JSON.stringify(await docOf(api, t.id)).includes('"alt":"The company mark"'),
      { message: 'the saved logo carries its alt text' }).toBe(true);
  });

  test('a freshly inserted Columns is ready to type in and carries its menu', async ({ page, api, name }) => {
    // The insert has to leave the caret in the first column. Between the
    // columns is a position the document allows and nothing wants:
    // `editor.isActive('columns')` is false there, so the columns menu does
    // not show, and neither does the text menu, the selection being empty —
    // the block a customer has just asked for would offer nothing at all.
    //
    // The caret is asserted first and on its own terms: the bubble-menu
    // plugin debounces, so the menu arriving says nothing about which
    // position the insert chose, and it is the position that the next
    // keystroke follows.
    const t = await api.createTemplate({ title: name('fresh columns') });
    const pm = await openEditor(page, t.id);
    await insertViaSlash(page, 'Columns');
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(2);

    const caret = await page.evaluate(() => {
      const node = window.getSelection()?.anchorNode;
      const el = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
      const column = el?.closest('[data-type="column"]');
      if (!column) return 'outside every column';
      return column === column.parentElement?.firstElementChild ? 'in the first column' : 'in a later column';
    });
    expect(caret, 'the insert leaves the caret in the first column, where a customer writes next')
      .toBe('in the first column');

    // The menu a customer reaches for is up without anything being typed,
    // and what is typed goes where the caret was said to be.
    await expectOnScreen(page, bubbleMenu(page, 'Columns'), 'the columns menu');
    await page.keyboard.type('Left');
    await expect(pm.locator('div[data-type="column"]').first()).toHaveText('Left');
    await expect(pm.locator('div[data-type="column"]').nth(1)).toHaveText('');
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
    await expect(indicator).toHaveAccessibleName('Select this Repeat, 2 rows');

    await indicator.click();
    const menu = bubbleMenu(page, 'Repeat');
    await expectOnScreen(page, menu, 'the repeat menu');
    await menu.getByRole('button', { name: 'items', exact: true }).click();
    await menu.getByPlaceholder('ie. payload.items').fill('orders');
    await page.keyboard.press('Enter');
    await expect.poll(async () => JSON.stringify(await docOf(api, t.id)).includes('"each":"orders"'),
      { message: 'the saved Repeat names the list it walks' }).toBe(true);

    // At one row the strip draws no count, and the count used to be all the
    // name it had: a `role="button"` with nothing on it.
    await menu.getByRole('button', { name: 'Fewer preview rows' }).click();
    await expect(repeat.locator('.mly-repeat-copy')).toHaveCount(0);
    await expect(indicator).toHaveAccessibleName('Select this Repeat');

    await menu.getByRole('button', { name: 'More preview rows' }).click();
    await menu.getByRole('button', { name: 'More preview rows' }).click();
    await expect(repeat.locator('.mly-repeat-copy')).toHaveCount(2);
    await expect(indicator).toHaveAccessibleName('Select this Repeat, 3 rows');

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
    // Typed straight after the click, with nothing waited for: the canvas
    // keeps the focus through a row of the block menu, so the word lands in
    // the first column — which is where the insert leaves the caret, inside
    // a Section as much as at the top level.
    await expect(pm.locator('div[data-type="column"]')).toHaveCount(2);
    await page.keyboard.type('Left');
    await expect(pm.locator('div[data-type="column"]').first()).toHaveText('Left');

    const section = bubbleMenu(page, 'Section');
    await expect(section).toBeVisible();
    // The Columns menu stands down inside a Section; its controls move into
    // the Section menu behind a button that says which they are.
    await expect(bubbleMenu(page, 'Columns')).toHaveCount(0);
    const column = section.getByRole('button', { name: 'Column', exact: true });
    await expect(column).toBeVisible();
    await column.click();
    const inside = section.getByRole('dialog', { name: 'Column' });
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

    const repeatMenu = bubbleMenu(page, 'Repeat');
    const sectionMenu = bubbleMenu(page, 'Section');
    await expectOnScreen(page, repeatMenu, 'the repeat menu');
    await expectOnScreen(page, sectionMenu, 'the section menu');
    // Which one moves is not a toss-up. Each menu asks whether a nested
    // block of the other kind, anywhere in its subtree, is the active one:
    // the Repeat holds the Section and the Section is where the caret is, so
    // the Repeat goes below; the Section asks after a Repeat inside itself,
    // has none, and keeps the spot above. The pair is asserted rather than
    // the presence of a `bottom`, because two `top`s — what a rule that
    // stopped asking would give — is the two menus back on top of each
    // other, which is the failure this case is named for.
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
    const fields = page.getByRole('dialog', { name: 'Variable' });
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

    // The eye renders only for a paragraph or a heading, and it says what it
    // does: a tooltip is a description, so until it became the name too this
    // was "the menu's last control" and nothing else.
    const menu = bubbleMenu(page, 'Text formatting');
    const eye = menu.getByRole('button', { name: 'Show block conditionally', exact: true });
    await eye.click();
    const dialog = menu.getByRole('dialog', { name: 'Show if' });
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

  test('the autosave says nothing until it has something to say', async ({ page, api, name }) => {
    // The word and the announcement are two things. The one that carried
    // both sat at opacity 0 while idle still holding "Saved", and a live
    // region is read whatever its opacity — so a template nobody had touched
    // announced that it had been saved.
    const t = await api.createTemplate({ title: name('autosave') });
    const pm = await openEditor(page, t.id);
    const status = page.getByRole('status');
    await expect(status, 'nothing has happened, so there is nothing to announce').toHaveText('');

    await pm.click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect(status).toHaveText('Saved');
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
    // The Ctrl set is written out rather than chosen at run time. Which set
    // the sheet shows is the browser's platform and not the host's, and this
    // project's browser is its own input: `devices['Desktop Chrome']` in
    // e2e/playwright.config.ts reports a platform `useIsApple` reads as not
    // an Apple one, whatever machine the suite runs on. Deriving the set here
    // would only re-state the rule under test; if the descriptor changes,
    // this case going red is the right answer. The ⌘ set every Mac customer
    // actually reads has no browser here to render it, and is pinned in
    // client/lib/editor-shortcuts.test.ts instead.
    const keys = ['/', '@', '---', 'Ctrl+Alt+C', '# ', '- ', '1. ', '> ', '**text**', 'Shift+Enter', 'Ctrl+Shift+↑', 'Ctrl+Shift+↓', 'Ctrl+Shift+D', 'Ctrl+Shift+Space', 'Ctrl+Shift+F', 'Ctrl+Shift+Backspace', 'Ctrl+B', 'Ctrl+I', 'Ctrl+U', 'Ctrl+Z'];
    await expect(sheet.locator('kbd'), 'every shortcut is listed, in its group and in order').toHaveText(keys);
    // And again unnormalised. The assertion above trims each key before
    // comparing, so it reads `# ` as `#` — and the trailing space is the
    // load-bearing half, the input rule being what fires on it. The wait has
    // settled by the line above, so this raw read needs none of its own.
    expect(await sheet.locator('kbd').allTextContents(),
      'the keys are listed exactly, trailing spaces and all').toEqual(keys);

    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
    // The sheet answers to its own shortcut too.
    await page.keyboard.press('ControlOrMeta+/');
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('the shortcuts the cheatsheet lists do what it says', async ({ page, api, name }) => {
    // Thirteen fresh templates, for the reason below, and thirteen cold
    // editor renders with them. Splitting the case along its own comment boundaries
    // would buy the same headroom and pay for it three times over in the
    // `page` fixture's own sign-in refresh and first navigation, so the
    // budget is raised instead and the case stays one story.
    test.slow();
    // A template per case, the way the block cases further up take one.
    // Two cases cannot share a document: `newLine` is the only way to a
    // fresh top-level line — which every case needs, an input rule having to
    // start a textblock and a Blocks shortcut reaching only the top-level
    // block the caret is in — and it asks that the new line be the
    // document's last block, which the divider, list or quote the case
    // before left there makes impossible. Clicking a line further up instead
    // is no way round it: a click moves the browser's selection at
    // once and the editor's own a tick later, and a key pressed in between
    // is dealt with where the editor still believes the caret is — the end
    // of the document, where the canvas opened. On a fresh template that is
    // the line `newLine` clicks, which is why this pattern is the safe one.
    const open = opener({ page, api, name });

    // Insert: the two characters that open a panel.
    await open('slash');
    await newLine(page);
    await page.keyboard.type('/');
    await expect(slashMenu(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(slashMenu(page)).toBeHidden();

    await open('variable');
    await newLine(page);
    await page.keyboard.type('@');
    const variables = page.locator('.tippy-box').filter({ hasText: 'Variables' });
    await expect(variables).toBeVisible();
    // Backspace rather than Escape: taking the `@` away is what ends the
    // query, and the panel goes with it.
    await page.keyboard.press('Backspace');
    await expect(variables).toBeHidden();

    // Insert: the one combination in the group. Whether the block it builds
    // still sends is asserted by its own case further up; what this one owes
    // the reader is that the keys on the sheet produce the block the sheet
    // names.
    let pm = await open('custom html');
    await newLine(page);
    await page.keyboard.press('ControlOrMeta+Alt+C');
    await expect(pm.locator('[data-type="htmlCodeBlock"]')).toHaveCount(1);

    // Insert and Write: the markdown-style inputs, typed as the cheatsheet
    // writes them. The divider is the one that carries no trailing space —
    // its rule fires on the third dash.
    pm = await open('divider');
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
    await expect(bubbleMenu(page, 'Text formatting')).toBeVisible();
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

    // Blocks: the route into the menu that acts on the selection, and the
    // Escape that gives the caret back. Every bubble menu is appended outside
    // the editor — the text menu to the page itself — so Tab leads to none of
    // them and this is the only way in from the keyboard. What makes it a
    // route rather than a trip is the selection surviving both halves: the
    // bold at the end lands on what was selected before any of it.
    await movable.click({ clickCount: 3 });
    const formatting = bubbleMenu(page, 'Text formatting');
    await expect(formatting).toBeVisible();
    await page.keyboard.press('ControlOrMeta+Shift+F');
    await expect(formatting.getByRole('button', { name: 'Turn into', exact: true }),
      'the first control of the menu takes the focus').toBeFocused();
    await page.keyboard.press('Escape');
    await expect(pm, 'Escape hands the caret back to the canvas').toBeFocused();
    await page.keyboard.press('ControlOrMeta+B');
    await expect(pm.locator('strong'), 'and the selection it came from is still there').toHaveText('movable');
  });

  test('a document that ends in a list still has a line of its own to type on', async ({ page, api, name }) => {
    // A list is one of the three shapes ProseMirror will place no caret
    // after — a blockquote and a numbered list are the others. Every
    // position at the end of such a document is inside the wrapper, so the
    // next block a customer asks for is built in there and the template
    // grows a level deep for no reason anyone chose.
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Above the list' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] }] },
      ],
    });
    const t = await api.createTemplate({ title: name('trailing line'), content: doc });
    const pm = await openEditor(page, t.id);

    // The document's own last block is the list, so a top-level paragraph
    // after it is one the editor kept rather than one the seed carried.
    const last = pm.locator('> *').last();
    await expect(last, 'the editor keeps a top-level line after the list').toHaveJSProperty('tagName', 'P');
    await expect(last).toBeEmpty();

    // And it is a real line: a block asked for there lands beside the list
    // rather than inside it.
    await insertViaSlash(page, 'Heading 2');
    await page.keyboard.type('After the list');
    await expect(pm.locator('> h2'), 'the heading is a sibling of the list, not a child').toHaveText('After the list');
    await expect(pm.locator('ul h2')).toHaveCount(0);
  });

  test('a document that ends in a Section is not rewritten when it is opened', async ({ page, api, name }) => {
    // A caret already fits after a Section — ProseMirror puts a gap cursor
    // there — so nothing is added, and the saved document is the one the
    // customer left. A line added here would reach the recipient as a blank
    // line under the last block the next time the template was published.
    const content = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Above the section' }] },
        { type: 'section', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inside' }] }] },
      ],
    };
    const t = await api.createTemplate({ title: name('unchanged shape'), content: JSON.stringify(content) });
    const pm = await openEditor(page, t.id);

    await expect(pm.locator('> *'), 'the canvas holds the two blocks the document holds').toHaveCount(2);
    await expect(pm.locator('> *').last(), 'the Section is still the last block').toHaveAttribute('data-type', 'section');

    // The shape is what is saved, too: typing into the Section sends a draft,
    // and that draft carries no block the customer did not ask for.
    await pm.locator('table[data-type="section"] p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect.poll(async () => (await docOf(api, t.id)).content?.length,
      { message: 'the saved draft still holds two top-level blocks' }).toBe(2);
  });

  test('a Custom HTML block at the end is a line of its own, and the document goes on after it', async ({ page, api, name }) => {
    // A code block is a textblock, so the caret sits inside it the way it
    // sits inside a heading — which is why no line is added after one, and
    // why that has to be true of the canvas and not only of the schema. The
    // way out is the one thing a code block does differently: Enter adds a
    // line of code, and ArrowDown is what makes the paragraph below.
    const content = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Above the markup' }] },
        { type: 'htmlCodeBlock', content: [{ type: 'text', text: '<b>bold</b>' }] },
      ],
    };
    const t = await api.createTemplate({ title: name('trailing html'), content: JSON.stringify(content) });
    const pm = await openEditor(page, t.id);

    const block = pm.locator('[data-type="htmlCodeBlock"]');
    await expect(block, 'the block the document ends in has painted').toHaveText('<b>bold</b>');
    await expect(pm.locator('> *'), 'the canvas holds the two blocks the document holds').toHaveCount(2);

    // The caret is a real one: a character typed at the end of the block
    // lands in the markup rather than anywhere else.
    await block.click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect(block, 'the block takes what is typed into it').toHaveText('<b>bold</b>!');

    // And the document continues: ArrowDown out of the block makes the line
    // that a trailing paragraph would otherwise have had to provide.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('After the markup');
    await expect(pm.locator('> p').last(), 'ArrowDown out of the block makes the next line')
      .toHaveText('After the markup');
  });

  test('a Section’s menu waits for the customer to ask for it', async ({ page, api, name }) => {
    // The editor opens with `autofocus="end"`, which parks the caret inside
    // whatever the document ends in. A menu is a response to a gesture, so a
    // template ending in a Section must open with nothing over the block
    // above it until the customer touches the canvas.
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'The line above' }] },
        { type: 'section', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inside' }] }] },
      ],
    });
    const t = await api.createTemplate({ title: name('menu on open'), content: doc });
    const pm = await openEditor(page, t.id);

    // The caret is where autofocus put it — inside the Section — and the menu
    // is still down. Founded on the focus, not on the paint: prosemirror-view
    // adds this class when autofocus lands, and tiptap raises a menu in a
    // timeout after that, so a menu asserted hidden any earlier would be
    // hidden whether or not the gate held.
    await expect(pm, 'autofocus has landed in the canvas').toHaveClass(/ProseMirror-focused/);
    await expect(pm.locator('table[data-type="section"] p').first()).toHaveText('Inside');
    await expect(bubbleMenu(page, 'Section'), 'no Section menu before anything is asked for').toBeHidden();

    await pm.locator('table[data-type="section"] p').first().click();
    await expectOnScreen(page, bubbleMenu(page, 'Section'), 'the section menu after the click');
  });

  test('a block inserted at the bottom of a scrolled canvas is brought into view', async ({ page, api, name }) => {
    // ProseMirror scrolls the selection into view inside the transaction that
    // makes it, and a Section is drawn by a React node view that has not
    // mounted yet — so the scroll is measured against a placeholder of no
    // height and lands nowhere. On a canvas already scrolled to its bottom
    // the new block was left below the fold with its menu, which is the only
    // way to reach what a Section can be told to do: the customer picked
    // Section and nothing appeared to happen.
    const doc = JSON.stringify({
      type: 'doc',
      content: Array.from({ length: 14 }, (_, i) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: `Line ${i + 1}` }],
      })),
    });
    const t = await api.createTemplate({ title: name('insert at the bottom'), content: doc });
    const pm = await openEditor(page, t.id);
    await expect(pm.locator('> p').last()).toHaveText('Line 14');

    // The block the insert happens under is the last one resting wholly on
    // screen, with the rest of the canvas below the fold — the state a
    // customer is in whenever the document is taller than the window, and
    // the only one where there is anywhere for a new block to be lost.
    const lastWhollyVisible = await pm.locator('> p').evaluateAll((lines) =>
      lines.reduce((best, line, index) => {
        const rect = line.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight ? index : best;
      }, 0),
    );
    const under = pm.locator('> p').nth(lastWhollyVisible);
    await under.hover();
    await page.getByRole('button', { name: 'Add a block below' }).click();
    await slashRow(page, 'Section').click();

    const section = pm.locator('table[data-type="section"]');
    await expect(section, 'the Section is inserted').toHaveCount(1);
    await expectOnScreen(page, section, 'the Section that was just made');
    await expectOnScreen(page, bubbleMenu(page, 'Section'), 'its menu');
  });

  test('a Section inserted with the mouse alone carries its menu', async ({ page, api, name }) => {
    // The whole route out of the canvas: the drag handle sits beside the
    // canvas in the DOM and the block panel on the body, so a customer who
    // hovers a block, presses "+" and picks a block never touches the canvas
    // itself. That is as unmistakably a gesture as a click in the text, and
    // the block it makes has to arrive with its menu up — the menu is the
    // only way to reach what a Section can be told to do.
    const doc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The only line' }] }],
    });
    const t = await api.createTemplate({ title: name('handle insert'), content: doc });
    const pm = await openEditor(page, t.id);
    await expect(pm.locator('> p')).toHaveText('The only line');

    // Where the canvas sits is this case's own setup, not something left to
    // whatever scrolled last: a hover only scrolls what is not already in
    // view, so a line resting on the bottom edge is hovered where it lies and
    // the Section built under it takes its menu off the fold with it. The
    // section menu is placed with tippy's flip disabled, by the same decision
    // that keeps it pinned to the block's top corner, so nothing brings it
    // back. The case is about the route through the handle; the fold is the
    // menu-anchoring cases' subject, and they seed it themselves.
    await pm.locator('> p').evaluate((el) => el.scrollIntoView({ block: 'center' }));

    // Hovering is not a gesture — nothing is asked for by it — but it is what
    // brings the handle out.
    await pm.locator('> p').hover();
    const add = page.getByRole('button', { name: 'Add a block below' });
    await expect(add, 'the drag handle offers a block below').toBeVisible();

    // The handle advertises the way to the same block without a pointer, and
    // what it advertises has to be the binding the editor answers to: it
    // named ⌘⇧L long after TextAlign took that combination and the editor
    // moved to Space. Both halves are read, because they are written
    // separately — `aria-keyshortcuts` names its modifiers where the tooltip
    // draws them. The Ctrl set is written out for the same reason the
    // cheatsheet case writes it out: this project's browser descriptor
    // reports a platform `useIsApple` reads as not an Apple one, whatever
    // machine the suite runs on, and the ⌘ set is pinned in
    // client/lib/editor-shortcuts.test.ts.
    const handle = page.getByRole('button', { name: 'Block actions' }).first();
    await expect(handle).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+Space');
    await handle.hover();
    // Read off the handle rather than off the tooltip: tippy gives every box
    // it positions `role="tooltip"`, and the handle rides in one of those, so
    // the role alone names two things here. The description is the half a
    // reader is given anyway — Radix points the trigger at the tooltip with
    // `aria-describedby`, and only while it is up.
    await expect(handle).toHaveAccessibleDescription('Block actions — or press Ctrl+Shift+Space');

    await add.click();

    await expect(slashRow(page, 'Section')).toBeVisible();
    await slashRow(page, 'Section').click();
    await expect(pm.locator('table[data-type="section"]'), 'the Section is inserted').toHaveCount(1);
    await expectOnScreen(page, bubbleMenu(page, 'Section'), 'the section menu after the insert');
  });

  test('a Section’s menu can be put down, and gives the block above back', async ({ page, api, name }) => {
    // The menu hangs over whatever sits above the Section, so while it is up
    // that block can be neither read nor clicked. Escape is the way to put
    // it down, and the only one: there is nowhere else to click that does
    // not first go through the menu.
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'The line above' }] },
        { type: 'section', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inside' }] }] },
      ],
    });
    const t = await api.createTemplate({ title: name('dismiss section'), content: doc });
    const pm = await openEditor(page, t.id);
    // Autofocus landing is what says the menu has had its chance — tiptap
    // raises one in a timeout after that — and the Section's own text is what
    // says the canvas has painted: a click that arrives before it can land on
    // a node ProseMirror is still putting together, and the caret would never
    // reach the Section.
    await expect(pm, 'autofocus has landed in the canvas').toHaveClass(/ProseMirror-focused/);
    await expect(pm.locator('table[data-type="section"] p').first()).toHaveText('Inside');

    const menu = bubbleMenu(page, 'Section');
    // The menu is down until it is asked for, so raising it is what the click
    // below proves rather than something that was already true.
    await expect(menu, 'the menu is down before the Section is clicked').toBeHidden();
    await pm.locator('table[data-type="section"] p').first().click();
    await expectOnScreen(page, menu, 'the section menu');

    // With the pointer resting on a control, its tooltip is up — a Radix
    // layer the customer never asked for. Escape has to reach past it: a
    // hint that swallowed the press would cost a second one.
    // Named exactly, because tippy gives every bubble menu the tooltip role
    // as well and the hint is the one whose whole name is the control's.
    await menu.getByRole('button', { name: 'Delete Section' }).hover();
    await expect(page.getByRole('tooltip', { name: 'Delete Section', exact: true }),
      'the control names itself on hover').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu, 'Escape puts the section menu down').toBeHidden();
    // What the dismissal was for: the line the menu was covering takes a
    // click again. Playwright refuses to click through whatever is on top,
    // so the click landing is half the assertion; the character typed into
    // that line is the other half — the caret went where the click did.
    await pm.getByText('The line above').click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await expect(pm.locator('> p').first(), 'the line the menu was covering takes the caret back').toHaveText('The line above!');

    // Asking again brings it back: the dismissal was of this visit to the
    // Section, not of the menu for good.
    await pm.locator('table[data-type="section"] p').first().click();
    await expectOnScreen(page, bubbleMenu(page, 'Section'), 'the section menu again');
  });

  test('the canvas keeps the focus through the block menu, so nothing typed is lost', async ({ page, api, name }) => {
    // A row of the block menu is a button, and a button takes the focus when
    // it is pressed unless it is told not to. A canvas that has to take the
    // focus back loses whatever was typed in between — the first word of
    // whatever the block was asked for to hold.
    const t = await api.createTemplate({ title: name('keeps focus') });
    const pm = await openEditor(page, t.id);
    await newLine(page);
    await page.keyboard.type('/');
    await expect(slashRow(page, 'Heading 1')).toBeVisible();
    await slashRow(page, 'Heading 1').click();
    // No wait of any kind between the click and the typing: this is the gap
    // the keystrokes were falling into.
    await page.keyboard.type('Every letter');
    await expect(pm.getByRole('heading', { level: 1 }), 'every letter typed straight after the click reached the document')
      .toHaveText('Every letter');
  });

  test('a subject typed as the shell swaps is still saved', async ({ page, api, name }) => {
    // Crossing 640px swaps the shell and remounts the editor, and the
    // autosave re-reads its baseline when it does. A baseline taken from
    // what is on screen counts a keystroke still inside the debounce as
    // already saved, and it is then never sent — the work is lost with no
    // sign that anything went.
    const t = await api.createTemplate({ title: name('shell swap') });
    await openEditor(page, t.id);
    const subject = page.getByRole('textbox', { name: 'Subject' });
    const typed = name('typed through the swap');
    await subject.fill(typed);
    // Straight into the swap, inside the 500 ms the autosave waits.
    await page.setViewportSize({ width: 500, height: 900 });
    // The phone shell puts the subject behind this button, and the desktop
    // shell has no such control — so it is the one thing on screen that says
    // the swap the case is about actually happened. The canvas is in both.
    await expect(page.getByRole('button', { name: /^Edit details:/ }), 'the phone shell is the one on screen').toBeVisible();
    await expect.poll(async () => (await api.getTemplate(t.id)).title,
      { message: 'the subject typed before the swap reaches the server' }).toBe(typed);
  });
});
