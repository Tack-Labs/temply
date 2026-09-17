import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { phone } from '../fixtures/phone';

// The canvas is a contenteditable, so the `.ProseMirror` locators below are
// the one place a DOM selector stands in for a role: ProseMirror's own class
// names are its public contract for what is selected, and a node view's
// `data-type` — `data-maily-component` for the blocks named that way — is the
// editor's for what a block is. `[data-editor-bottom-bar]`
// is the second: the bar's controls share their names with the sheets that
// open above them, so scoping to the bar is what keeps a name unambiguous.
// The third is `[inert]`, inside `phone.live` — the face that is down is
// inert rather than unmounted, and Playwright's role engine does not honour
// inert, so the scope has to. Everything else is found the way a screen
// reader would find it.

// The header's Done, which ends typing. The input dock's submit carries the
// same name and stays mounted once a dock has been opened, so the banner is
// what tells the two apart.
const done = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Done', exact: true });

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const TWO_PARAGRAPHS = JSON.stringify({ type: 'doc', content: [paragraph('Hello from e2e'), paragraph('A second paragraph')] });

// Every block the + sheet offers, under the heading it sits beneath. The
// phone's roster is its own, not the slash menu's: what the sheet drops is
// as much the product as what it keeps.
const TILES = {
  Content: ['Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Bullet List', 'Numbered List', 'Image', 'Logo', 'Button', 'Blockquote'],
  Layout: ['Columns', 'Section', 'Divider', 'Spacer'],
  Logic: ['Repeat', 'Custom HTML'],
  Components: ['Headers', 'Footers'],
};

test.describe('editor on the phone', () => {
  test('one tap selects a block, a second tap edits it', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('tap'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    // Known gap in the tap model, not the design: on an idle document the
    // editor parks an unfocused caret in the first textblock, and
    // `tapTransaction` mistakes that caret for "already typing", so the
    // first tap there edits instead of selecting. The second paragraph is
    // tapped until that is fixed; the fixme below records the case.
    const para = page.locator('.ProseMirror > p').nth(1);
    await phone.tapBlock(page, para);
    await expect(phone.bar(page).button('Delete')).toBeVisible();
    await expect(page.locator('.ProseMirror-selectednode')).toHaveCount(1);
    await phone.editBlock(page, para);
    // Done is the header's, not the bar's: the text face costs the bar the
    // room a second copy would need. The dock's ✓ answers to the same name,
    // so the header is the scope.
    await expect(done(page)).toBeVisible();
    await page.keyboard.type(' typed');
    await expect(para).toContainText('typed');
  });

  // The same gap, as the test that turns on once it is closed: with nothing
  // selected the unfocused caret in the first textblock is read as "already
  // typing" (block-selection.ts, tapTransaction), and the first tap on that
  // block raises the keyboard instead of the action bar.
  test.fixme('one tap on the first block selects it', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('first') });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await phone.tapBlock(page, page.locator('.ProseMirror > p').first());
    await expect(phone.bar(page).button('Delete')).toBeVisible();
    await expect(page.locator('.ProseMirror-selectednode')).toHaveCount(1);
  });

  test('the + sheet inserts a block at the end and selects it', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('insert') });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await phone.bar(page).add().click();
    const sheet = page.getByRole('dialog', { name: 'Add a block' });
    await sheet.getByRole('button', { name: 'Heading 1', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.locator('.ProseMirror > h1.ProseMirror-selectednode')).toHaveCount(1);
    await expect(phone.bar(page).button('Style')).toBeVisible();
  });

  test('Delete removes the tapped block, and the only block of a Repeat takes the Repeat', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('delete') });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await phone.bar(page).add().click();
    await page.getByRole('dialog', { name: 'Add a block' }).getByRole('button', { name: 'Repeat', exact: true }).click();
    const repeat = page.locator('.ProseMirror [data-type="repeat"]');
    await expect(repeat).toHaveCount(1);
    await phone.tapBlock(page, repeat.locator('p').first());
    // The tap, not something else, is what Delete acts on.
    await expect(page.locator('.ProseMirror-selectednode')).toHaveCount(1);
    await phone.bar(page).button('Delete').click();
    await expect(repeat).toHaveCount(0);
  });

  test('the text bar has a line-break key that breaks inside the block', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('break') });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    const para = page.locator('.ProseMirror > p').first();
    await phone.editBlock(page, para);
    await page.keyboard.press('End');
    await page.keyboard.type(' first');
    await page.getByRole('button', { name: 'Line break' }).click();
    await page.keyboard.type('second');
    await expect(page.locator('.ProseMirror > p')).toHaveCount(1);
    await expect(para.locator('br:not(.ProseMirror-trailingBreak)')).toHaveCount(1);
  });

  test('the bar shows what the customer can do right now', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('faces'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    // Idle: the email's own sections, nothing about a block. The nav is never
    // unmounted, only inert, so it is asked for live or it answers in every
    // state.
    const sections = page.getByRole('navigation', { name: 'Editor sections' }).and(phone.live(page));
    for (const tab of ['Details', 'Brand', 'Data', 'Checks']) {
      await expect(sections.getByRole('button', { name: new RegExp(`^${tab}`) })).toBeVisible();
    }
    await expect(phone.bar(page).button('Delete')).toHaveCount(0);

    // Block: one tap, and the bar is about the block.
    const para = page.locator('.ProseMirror > p').nth(1);
    await phone.tapBlock(page, para);
    for (const control of ['Move up', 'Move down', 'Style', 'Duplicate', 'Delete']) {
      await expect(phone.bar(page).button(control)).toBeVisible();
    }

    // Text: a second tap, and the bar is about the words.
    await phone.editBlock(page, para);
    for (const control of ['Bold', 'Italic', 'Underline', 'Link', 'Insert variable', 'Line break', 'More formatting']) {
      await expect(phone.bar(page).button(control)).toBeVisible();
    }
    await done(page).click();
    await expect(phone.bar(page).button('Delete')).toBeVisible();

    // Idle again: a tap on the margin is how a customer puts a block down.
    await page.mouse.click(5, 300);
    await expect(sections.getByRole('button', { name: 'Details' })).toBeVisible();
    await expect(phone.bar(page).button('Delete')).toHaveCount(0);
  });

  test('the Aa panel holds the formatting the row cannot, and centres the text', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('aa'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    const para = page.locator('.ProseMirror > p').nth(1);
    await phone.editBlock(page, para);
    await phone.bar(page).button('More formatting').click();

    for (const swatch of ['Black', 'Slate', 'Indigo', 'Red', 'Green', 'Amber', 'White']) {
      await expect(phone.bar(page).button(swatch)).toBeVisible();
    }
    for (const control of ['Link address', 'Align left', 'Align centre', 'Align right', 'Strikethrough', 'Code', 'Bullet list', 'Numbered list', 'Clear formatting']) {
      await expect(phone.bar(page).button(control)).toBeVisible();
    }
    await expect(page.locator('[data-editor-bottom-bar]').getByText('No link')).toBeVisible();

    await phone.bar(page).button('Align centre').click();
    await expect(phone.bar(page).button('Align centre')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the + sheet offers every block, in its group', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('plus roster') });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await phone.bar(page).add().click();

    const sheet = phone.sheet(page, 'Add a block');
    for (const [group, tiles] of Object.entries(TILES)) {
      await expect(sheet.getByRole('heading', { level: 3, name: group })).toBeVisible();
      for (const tile of tiles) {
        // A tile's whole accessible name is its title — no description
        // rides along — so `exact` is what makes "Heading 1" mean that tile
        // rather than anything whose name merely contains it.
        await expect(sheet.getByRole('button', { name: tile, exact: true }), `${tile} is offered`).toBeVisible();
      }
    }
    // Two blocks the phone deliberately does not offer: neither can be
    // configured by thumb once it exists, so + would be a dead end.
    await expect(sheet.getByRole('button', { name: 'Inline Image', exact: true })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Link Card', exact: true })).toHaveCount(0);
  });

  test('a sub-list adds a pre-designed block, and goes back', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('plus sub-list') });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await phone.bar(page).add().click();
    await phone.sheet(page, 'Add a block').getByRole('button', { name: 'Headers', exact: true }).click();

    const headers = phone.sheet(page, 'Headers');
    for (const tile of ['Logo with Text (Vertical)', 'Logo with Text (Horizontal)', 'Logo with Cover Image']) {
      await expect(headers.getByRole('button', { name: tile, exact: true })).toBeVisible();
    }
    // The back button answers to the sheet's own title, so it is reached
    // through the sub-list dialog rather than the page.
    await headers.getByRole('button', { name: 'Add a block', exact: true }).click();
    await expect(phone.sheet(page, 'Add a block').getByRole('button', { name: 'Footers', exact: true })).toBeVisible();

    await phone.sheet(page, 'Add a block').getByRole('button', { name: 'Footers', exact: true }).click();
    await phone.sheet(page, 'Footers').getByRole('button', { name: 'Footer Copyright', exact: true }).click();
    await expect(page.locator('.ProseMirror').getByText(`Temply © ${new Date().getFullYear()}. All rights reserved.`)).toBeVisible();
  });

  test('what the + sheet makes is selected, and a wrapper is selected as itself', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('plus selects') });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    await phone.bar(page).add().click();
    await phone.sheet(page, 'Add a block').getByRole('button', { name: 'Columns', exact: true }).click();
    await expect(page.locator('.ProseMirror div[data-type="column"]')).toHaveCount(2);
    // The tap model never selects a wrapper; inserting one does, and the
    // Style sheet is then the wrapper's own rather than a stack.
    await expect(await phone.style(page, 'Columns')).toBeVisible();
    await phone.sheet(page, 'Columns').getByRole('button', { name: 'Close' }).click();

    // A list has nothing to style, so the bar offers no Style at all.
    await phone.bar(page).add().click();
    await phone.sheet(page, 'Add a block').getByRole('button', { name: 'Bullet List', exact: true }).click();
    await expect(page.locator('.ProseMirror ul > li')).toHaveCount(1);
    // Delete says the block face is up at all, which is what makes the
    // missing Style a statement rather than an empty bar.
    await expect(phone.bar(page).button('Delete')).toBeVisible();
    await expect(phone.bar(page).button('Style')).toHaveCount(0);
  });

  test('the Style sheet is named after the block and offers its settings', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('style sheet'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    // A paragraph: the words' own settings. The unnamed controls in this
    // sheet — colours, alignment, the link trigger — are labelled by a
    // tooltip, which is not a name, and are left to the findings list.
    await phone.tapBlock(page, page.locator('.ProseMirror > p').nth(1));
    const text = await phone.style(page, 'Text');
    await expect(text).toBeVisible();
    for (const control of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Code', 'Show block conditionally']) {
      await expect(text.getByRole('button', { name: control, exact: true })).toBeVisible();
    }
    await text.getByRole('button', { name: 'Close' }).click();
    await expect(text).toBeHidden();

    // A spacer: five sizes, and the size a customer picks holds.
    await phone.bar(page).add().click();
    await phone.sheet(page, 'Add a block').getByRole('button', { name: 'Spacer', exact: true }).click();
    const spacer = await phone.style(page, 'Spacer');
    await expect(spacer).toBeVisible();
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl']) {
      await expect(spacer.getByRole('button', { name: size, exact: true })).toBeVisible();
    }
    await spacer.getByRole('button', { name: 'xl', exact: true }).click();
    await expect(page.locator('.ProseMirror div[data-maily-component="spacer"]')).toHaveAttribute('data-height', '64');
    await spacer.getByRole('button', { name: 'Close' }).click();
    await expect(spacer).toBeHidden();

    // A section: the settings a customer reaches for, and the way out. Two of
    // them, because one would not tell the two closing rules apart — the
    // sheet that has nothing left to show closes on that alone. With a
    // neighbour to fall back on, what is selected after the delete still has
    // settings, so only the followed position can say the block is gone.
    const sections = page.locator('.ProseMirror table[data-type="section"]');
    for (let i = 0; i < 2; i++) {
      await phone.bar(page).add().click();
      await phone.sheet(page, 'Add a block').getByRole('button', { name: 'Section', exact: true }).click();
    }
    await expect(sections).toHaveCount(2);
    const section = await phone.style(page, 'Section');
    await expect(section).toBeVisible();
    for (const control of ['Border Radius', 'Border Width', 'Margin', 'Padding']) {
      await expect(section.getByRole('button', { name: control })).toBeVisible();
    }
    await section.getByRole('button', { name: 'Delete Section' }).click();
    await expect(sections).toHaveCount(1);
    await expect(section).toBeHidden();
  });

  test('a block inside a wrapper reaches the wrapper’s settings too', async ({ page, api, name }) => {
    // A paragraph inside a Repeat inside a Section: one sheet, stacked
    // outermost first, and the paragraph's own controls last. The lead
    // paragraph takes the document's first textblock, where an idle editor
    // parks an unfocused caret the tap model reads as "already typing" —
    // the same gap the fixme above records.
    const doc = JSON.stringify({
      type: 'doc',
      content: [paragraph('Above the section'), {
        type: 'section',
        content: [{ type: 'repeat', attrs: { each: 'items', showIfKey: null }, content: [paragraph('Inside both')] }],
      }],
    });
    const t = await api.createTemplate({ title: name('stacked'), content: doc });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    // A Repeat draws its preview rows as static copies of the live one, so
    // the text appears more than once. The copies are `aria-hidden`, which
    // the role engine honours and a text query does not — so the live row is
    // asked for as the paragraph a screen reader can reach.
    await phone.tapBlock(page, page.locator('.ProseMirror').getByRole('paragraph').filter({ hasText: 'Inside both' }));
    const sheet = await phone.style(page, 'Text');
    await expect(sheet).toBeVisible();
    // Outermost first is the whole point, and a multi-element locator answers
    // in DOM order, so the two bands are asserted as a sequence rather than
    // one at a time. The band labels are the only nodes in the sheet whose
    // whole text is `Section` or `Repeat` — the Section's own control reads
    // `Delete Section` and the Repeat's row reads `Repeat over items` — so a
    // third match would fail this as a count mismatch.
    await expect(sheet.getByText(/^(Section|Repeat)$/)).toHaveText(['Section', 'Repeat']);
    await expect(sheet.getByRole('button', { name: 'Delete Section' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Repeat over items' })).toBeVisible();
    // The block's own controls come last, below both bands. Their presence is
    // asserted here but not their place in the order: they are icon-only and
    // named through `aria-label`, and the array form that pins a sequence
    // reads text content, which they have none of.
    await expect(sheet.getByRole('button', { name: 'Bold', exact: true })).toBeVisible();
  });
});
