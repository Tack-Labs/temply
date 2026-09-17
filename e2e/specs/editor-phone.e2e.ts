import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { phone } from '../fixtures/phone';

// The canvas is a contenteditable, so the `.ProseMirror` locators below are
// the one place a DOM selector stands in for a role: ProseMirror's own class
// names are its public contract for what is selected, and a node view's
// `data-type` is the editor's for what a block is. `[data-editor-bottom-bar]`
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
});
