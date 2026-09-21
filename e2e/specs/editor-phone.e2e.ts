import { test, expect } from '../fixtures/test';
import { phone } from '../fixtures/phone';

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const TWO_PARAGRAPHS = JSON.stringify({ type: 'doc', content: [paragraph('Hello from e2e'), paragraph('A second paragraph')] });
const EMPTY = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });

/** A tap where a finger would land: inside the block's text, clear of any control. */
async function tapBlock(page: import('@playwright/test').Page, block: import('@playwright/test').Locator) {
  await block.scrollIntoViewIfNeeded();
  const box = await block.boundingBox();
  if (!box) throw new Error('the block is not on screen');
  await page.mouse.click(box.x + 20, box.y + Math.min(10, box.height / 2));
}

test.describe('editor on the phone', () => {
  test('the banner says editing is on desktop', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('banner'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await expect(page.getByText('Editing is on desktop.')).toBeVisible();
    await expect(page.getByText('Details, preview and publishing still work here.')).toBeVisible();
  });

  test('a tap on a block changes nothing', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('inert'), content: TWO_PARAGRAPHS });
    const before = (await api.getTemplate(t.id)).content;
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    await tapBlock(page, page.locator('.ProseMirror > p').first());
    // Nothing a tap used to raise: no selection drawn, no block face on the
    // bar, and nothing typed afterwards reaches the document. Focus itself
    // is not the claim — ProseMirror can keep a read-only node focusable —
    // so what a keystroke does is what the case reads.
    await expect(page.locator('.ProseMirror-selectednode')).toHaveCount(0);
    await expect(phone.bar(page).button('Delete')).toHaveCount(0);
    await page.keyboard.type('nothing');
    await expect(page.locator('.ProseMirror')).toContainText('Hello from e2e');
    await expect(page.locator('.ProseMirror')).not.toContainText('nothing');
    expect((await api.getTemplate(t.id)).content, 'the document is what it was').toBe(before);
  });

  test('an empty email says so', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('empty'), content: EMPTY });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await expect(page.getByText('Nothing in this email yet. Open it on a desktop to add blocks.')).toBeVisible();
  });

  test('the details still save', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('details'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await page.getByRole('button', { name: /^Edit details/ }).click();
    const sheet = phone.sheet(page, 'Email details');
    await sheet.getByLabel('Subject').fill('A subject from a phone');
    await sheet.getByLabel('Preview text').fill('A preview line from a phone');
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect.poll(async () => (await api.getTemplate(t.id)).title,
      { message: 'the subject typed on a phone reaches the row' }).toBe('A subject from a phone');
    expect((await api.getTemplate(t.id)).preview_text).toBe('A preview line from a phone');
  });

  test('preview, HTML and text still show the email', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('preview'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Preview' }).click();
    const sheet = phone.sheet(page, 'Preview');
    await expect(sheet.getByTitle('Email preview').contentFrame().getByText('Hello from e2e')).toBeVisible();
    await sheet.getByRole('tab', { name: 'HTML' }).click();
    await expect(sheet.getByRole('code').filter({ hasText: 'Hello from e2e' })).toBeVisible();
    await sheet.getByRole('tab', { name: 'Text' }).click();
    await expect(sheet.getByRole('code').filter({ hasText: 'Hello from e2e' })).toBeVisible();
  });

  test('the brand still changes the theme', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('brand'), content: TWO_PARAGRAPHS });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    const before = (await api.getTemplate(t.id)).theme;
    await phone.bar(page).button('Brand').click();
    const sheet = phone.sheet(page, 'Brand');
    await sheet.getByRole('button', { name: 'Round' }).click();
    // The row's theme is a JSON blob whose encoding of "Round" is the knob's
    // business, not this case's: that the choice reached the row at all is
    // what the phone is being asked to still do.
    await expect.poll(async () => (await api.getTemplate(t.id)).theme,
      { message: 'the corner the phone chose reaches the row' }).not.toBe(before);
  });

  test('publishing still works from the phone', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('publish'), content: TWO_PARAGRAPHS });
    // A template made through the API is already published with matching
    // content (see publish-share.e2e.ts), so Publish stays disabled — there
    // is nothing to publish — until a draft actually diverges from it.
    await api.saveDraft(t.id, { title: name('publish edited'), content: TWO_PARAGRAPHS });
    const before = (await api.getTemplate(t.id)).published_at;
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Publish' }).click();
    await expect.poll(async () => (await api.getTemplate(t.id)).published_at,
      { message: 'the publish reaches the row' }).not.toBe(before);
  });

  test('the playground reads, and says where the editor is', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/playground');
    await phone.ready(page);
    await expect(page.getByText('Open on a desktop to try the editor.')).toBeVisible();
    const before = await page.locator('.ProseMirror').innerText();
    await tapBlock(page, page.locator('.ProseMirror > *').first());
    await page.keyboard.type('nothing');
    expect(await page.locator('.ProseMirror').innerText(), 'the demo reads, it does not write').toBe(before);
    await context.close();
  });
});
