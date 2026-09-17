import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';

/** Makes a key through the dialog and returns the full key from the card
 *  that shows it once. The row for the key repeats its 14-character prefix
 *  and an ellipsis, so only the full 32-character secret matches here. */
async function createKey(page: Page, mode: 'Test' | 'Live', keyName: string): Promise<string> {
  // An empty list draws a second "Create key" in its empty state; both open
  // the same dialog.
  await page.getByRole('button', { name: 'Create key' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create API key' });
  // Each radio is named by its label and the hint sentence under it, so the
  // label is matched at the start of the name rather than as the whole of it.
  await dialog.getByRole('radio', { name: new RegExp(`^${mode}\\b`) }).click();
  await dialog.getByRole('textbox', { name: 'Key name' }).fill(keyName);
  await dialog.getByRole('button', { name: 'Create key' }).click();
  await expect(page.getByText('Your new key')).toBeVisible();
  const key = await page.getByText(/^tply_(test|live)_[0-9A-Za-z]{32}$/).textContent();
  expect(key).toMatch(mode === 'Test' ? /^tply_test_/ : /^tply_live_/);
  return key!.trim();
}

// `page.request` carries the signed-in cookies, and the Next proxy forwards
// the Authorization header untouched; the public route ignores the cookies
// and authenticates by the bearer alone, which is what is being asserted.
const render = (request: APIRequestContext, shortCode: string, key: string) =>
  request.post(`/api/public/v1/templates/${shortCode}/render`, { headers: { Authorization: `Bearer ${key}` }, data: {} });

test.describe('api keys', () => {
  test('a test key renders the draft until it is revoked', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('rendered') });
    const { short_code } = await api.getTemplate(id);
    const keyName = name('test key');
    await page.goto('/dashboard/settings/api-keys');
    const key = await createKey(page, 'Test', keyName);
    api.trackApiKey((await api.apiKeyNamed(keyName)).id);

    const ok = await render(page.request, short_code, key);
    expect(ok.status()).toBe(200);
    expect((await ok.json()).html).toContain('Hello from e2e');

    // Both projects add keys to this list at the same time, so the row is
    // the one carrying this test's own name.
    const row = page.getByRole('row').filter({ hasText: keyName });
    await expect(row.getByText('Test', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('dialog', { name: 'Revoke this key?' }).getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByText('Key revoked')).toBeVisible();
    await expect(row.getByText('Revoked', { exact: true })).toBeVisible();

    const refused = await render(page.request, short_code, key);
    expect(refused.status()).toBe(401);
    expect((await refused.json()).message).toBe('Invalid or revoked API key');
  });

  test('a live key renders what is published', async ({ page, api, name }) => {
    // A template made through the API is published at creation, so a live
    // key has a published copy to serve.
    const { id } = await api.createTemplate({ title: name('live') });
    const { short_code } = await api.getTemplate(id);
    const keyName = name('live key');
    await page.goto('/dashboard/settings/api-keys');
    const key = await createKey(page, 'Live', keyName);
    api.trackApiKey((await api.apiKeyNamed(keyName)).id);
    const ok = await render(page.request, short_code, key);
    expect(ok.status()).toBe(200);
    expect((await ok.json()).mode).toBe('live');
  });
});
