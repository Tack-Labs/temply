import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { onPhone, subjectField, publish } from '../fixtures/editor';

// One of each finding preflight can name: an image with neither alt nor
// title, a variable pill with no placeholder and no preview value, and a
// button with no URL. Shapes as `shared/preflight.test.ts` pins them.
const DOC = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'image', attrs: { src: 'https://example.com/a.png', alt: '', title: '' } },
    { type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'variable', attrs: { id: 'name' } }] },
    { type: 'button', attrs: { text: 'Click', url: '', isUrlVariable: false } },
  ],
});
// A card too dark for the default body colour; every other theme field
// falls back to the default, which is all the contrast check needs.
const DARK_CARD = JSON.stringify({ container: { backgroundColor: '#333333' } });

const MESSAGES = {
  alt: 'An image has no alt text — clients that block images show nothing in its place.',
  variable: '{{name}} in a paragraph has no placeholder and no preview value — a test send needs one.',
  button: 'A button has no URL yet.',
};

/**
 * Opens the template and waits until the editor is live: a click or a fill
 * on the desktop page before React has mounted is lost, and the canvas is
 * drawn only once the editor has.
 */
async function open(page: Page, id: string) {
  await page.goto(`/templates/${id}`);
  await expect(page.locator('.ProseMirror').getByText('Click')).toBeVisible();
}

test.describe('checks', () => {
  test('preflight lists what would go wrong', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('findings'), content: DOC, theme: DARK_CARD });
    await open(page, id);
    const list = onPhone() ? page.getByRole('dialog', { name: 'Checks' }) : page;
    if (onPhone()) await page.getByRole('button', { name: /^Checks/ }).click();
    else await page.getByRole('button', { name: /^Preflight/ }).click();
    for (const message of Object.values(MESSAGES)) await expect(list.getByText(message)).toBeVisible();
    await expect(list.getByText(/^Body copy may be hard to read/)).toBeVisible();
  });

  test('an error arms Publish instead of publishing', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('armed'), content: DOC });
    await open(page, id);
    // A template made through the API is already published, so Publish
    // starts disabled; an edit to the subject enables it at once.
    await (await subjectField(page)).fill(name('armed edited'));
    if (onPhone()) await page.getByRole('dialog', { name: 'Email details' }).getByRole('button', { name: 'Close' }).click();
    await publish(page);
    const armed = onPhone() ? page.getByRole('menuitem', { name: 'Publish anyway' }) : page.getByRole('button', { name: 'Publish anyway' });
    if (onPhone()) {
      // Arming opens the Checks sheet on the phone; the menu is behind it.
      await expect(page.getByRole('dialog', { name: 'Checks' })).toBeVisible();
      await page.getByRole('dialog', { name: 'Checks' }).getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'More', exact: true }).click();
    }
    await expect(armed).toBeVisible();
    await expect(page.getByText('Published', { exact: true })).toHaveCount(0);
  });

  test('a finding on the phone jumps to its block', async ({ page, api, name }) => {
    test.skip(!onPhone(), 'desktop rows are not buttons: there is nothing to jump with');
    const { id } = await api.createTemplate({ title: name('jump'), content: DOC });
    await open(page, id);
    await page.getByRole('button', { name: /^Checks/ }).click();
    await page.getByRole('dialog', { name: 'Checks' }).getByRole('button', { name: MESSAGES.button }).click();
    await expect(page.getByRole('dialog', { name: 'Checks' })).toBeHidden();
    await expect(page.locator('.ProseMirror-selectednode')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  });
});
