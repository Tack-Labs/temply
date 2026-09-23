import { test, expect } from '../fixtures/test';
import { phone } from '../fixtures/phone';

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const TWO_PARAGRAPHS = JSON.stringify({ type: 'doc', content: [paragraph('Hello from e2e'), paragraph('A second paragraph')] });
const EMPTY = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
// A link card is a Popover the node view opens on itself, keyed off
// `props.selected` rather than the bar's tap model — the one place a tap on
// a read-only canvas could still open an editable surface if the node view
// forgot to check `editor.isEditable`.
const LINK_CARD_DOC = JSON.stringify({
  type: 'doc',
  content: [{
    type: 'linkCard',
    attrs: {
      mailyComponent: 'linkCard',
      title: 'A link card from e2e',
      description: 'Read-only on the phone',
      link: 'https://example.com',
      linkTitle: '',
      image: '',
      subTitle: '',
      badgeText: '',
    },
  }],
});
// Same hole, on the most common node in a template: Radix's PopoverTrigger
// wraps the pill in a real <button>, so the settings popover has to be kept
// shut by hand rather than by nothing existing to open.
const VARIABLE_DOC = JSON.stringify({
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [{
      type: 'variable',
      attrs: { id: 'first_name', label: null, fallback: 'Alex', required: true, hideDefaultValue: false },
    }],
  }],
});
// An empty Custom HTML block left on the Preview tab from a desktop session:
// the tab's own click handler, not a Popover, is what had no `isEditable` guard.
const HTML_PREVIEW_DOC = JSON.stringify({
  type: 'doc',
  content: [{
    type: 'htmlCodeBlock',
    attrs: { activeTab: 'preview', language: 'html' },
    content: [],
  }],
});
const REPEAT_DOC = JSON.stringify({
  type: 'doc',
  content: [{
    type: 'repeat',
    attrs: { each: 'items' },
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Repeated row' }] }],
  }],
});

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

  test('a link card opens no settings on a tap', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('link-card'), content: LINK_CARD_DOC });
    const before = (await api.getTemplate(t.id)).content;
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    await tapBlock(page, page.getByText('A link card from e2e'));
    await expect(page.getByRole('dialog', { name: 'Link Card' })).toHaveCount(0);
    expect((await api.getTemplate(t.id)).content, 'the document is what it was').toBe(before);
  });

  test('a variable pill opens no settings on a tap', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('variable'), content: VARIABLE_DOC });
    const before = (await api.getTemplate(t.id)).content;
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    await tapBlock(page, page.getByText('first_name'));
    await expect(page.getByRole('dialog', { name: 'Variable' })).toHaveCount(0);
    expect((await api.getTemplate(t.id)).content, 'the document is what it was').toBe(before);
  });

  test('an empty Custom HTML preview does not flip tabs on a tap', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('html'), content: HTML_PREVIEW_DOC });
    const before = (await api.getTemplate(t.id)).content;
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    const block = page.locator('[data-type="htmlCodeBlock"]');
    await tapBlock(page, block);
    // Flipping to Code swaps the shadow-rooted preview div for a `<pre>`;
    // its absence is what the tap failing to fire looks like from outside.
    await expect(block.locator('pre')).toHaveCount(0);
    expect((await api.getTemplate(t.id)).content, 'the document is what it was').toBe(before);
  });

  test('the repeat strip is not a button on a read-only canvas', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('repeat'), content: REPEAT_DOC });
    await page.goto(`/templates/${t.id}`);
    await phone.ready(page);

    // The strip's preview draws a second, static copy of the row beside the
    // live one, so the text is expected twice — `.first()` reaches the live
    // row without the case asserting anything about the copy.
    await expect(page.getByText('Repeated row').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Select this Repeat/ })).toHaveCount(0);
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

    // The demo's document arrives after the canvas element does, so a
    // baseline taken the moment `.ProseMirror` exists can still change for
    // reasons that have nothing to do with a tap — which is how this read
    // the tail of its own render as a write, under a loaded runner. Two
    // identical reads is the document having finished arriving.
    const canvas = page.locator('.ProseMirror');
    let before = '';
    await expect
      .poll(async () => {
        const now = await canvas.innerText();
        const settled = now.length > 0 && now === before;
        before = now;
        return settled;
      }, { message: 'the demo document has finished arriving' })
      .toBe(true);

    await tapBlock(page, canvas.locator('> *').first());
    await page.keyboard.type('nothing');
    expect(await canvas.innerText(), 'the demo reads, it does not write').toBe(before);
    await context.close();
  });
});
