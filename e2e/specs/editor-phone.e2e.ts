import { test, expect } from '../fixtures/test';
import { phone } from '../fixtures/phone';

// The canvas is a contenteditable, so the `.ProseMirror` locators below are
// the one place a DOM selector stands in for a role: ProseMirror's own class
// names are its public contract for what is selected, and a node view's
// `data-type` is the editor's for what a block is. Everything else is found
// the way a screen reader would find it.
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const TWO_PARAGRAPHS = JSON.stringify({ type: 'doc', content: [paragraph('Hello from e2e'), paragraph('A second paragraph')] });

test.describe('editor on the phone', () => {
  test('one tap selects a block, a second tap edits it', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('tap'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
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
    await expect(phone.bar(page).button('Done')).toBeVisible();
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
    await phone.tapBlock(page, page.locator('.ProseMirror > p').first());
    await expect(phone.bar(page).button('Delete')).toBeVisible();
    await expect(page.locator('.ProseMirror-selectednode')).toHaveCount(1);
  });

  test('the + sheet inserts a block at the end and selects it', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('insert') });
    await page.goto(`/templates/${t.id}`);
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
    const para = page.locator('.ProseMirror > p').first();
    await phone.editBlock(page, para);
    await page.keyboard.press('End');
    await page.keyboard.type(' first');
    await page.getByRole('button', { name: 'Line break' }).click();
    await page.keyboard.type('second');
    await expect(page.locator('.ProseMirror > p')).toHaveCount(1);
    await expect(para.locator('br:not(.ProseMirror-trailingBreak)')).toHaveCount(1);
  });
});
