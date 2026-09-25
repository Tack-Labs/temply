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
  await dialog.getByRole('radio', { name: mode, exact: true }).click();
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

  test('each key type is offered by its name, with its terms as the description', async ({ page }) => {
    // The choice is two words. Read off the tile it was twenty: "Live" ran
    // straight into the plan's marker with no separator and then into the
    // sentence of terms underneath, so hearing the second option meant
    // hearing the whole of the first.
    await page.goto('/dashboard/settings/api-keys');
    await page.getByRole('button', { name: 'Create key' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create API key' });
    const group = dialog.getByRole('radiogroup', { name: 'Key type' });
    await expect(group.getByRole('radio', { name: 'Live', exact: true })).toBeVisible();
    const test = group.getByRole('radio', { name: 'Test', exact: true });
    await expect(test).toBeVisible();
    // The terms are still read, as the description they are.
    await expect(test).toHaveAccessibleDescription('Renders your draft. Free on every plan, 1,000 calls a month.');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
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
