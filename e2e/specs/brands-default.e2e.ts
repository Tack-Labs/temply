import { test, expect } from '../fixtures/test';

// One default per workspace: these run in order, in one worker, on one
// project (phone-chromium ignores the file), so nothing else moves the
// default while they look at it.
test.describe.configure({ mode: 'serial', retries: 0 });

test.describe('brand defaults', () => {
  let brandName = '';
  let brandId = '';

  test('a brand can be made the default', async ({ page, name }) => {
    brandName = name('default warm');
    await page.goto('/dashboard/brands');
    await page.getByRole('button', { name: 'New brand' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create brand' });
    await dialog.getByRole('textbox', { name: 'Brand name' }).fill(brandName);
    await dialog.getByRole('button', { name: 'Warm', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Brand created')).toBeVisible();
    // Not handed to this test's cleanup: the brand has to outlive it for the
    // next two, and the last test tracks it.
    const { brands } = await (await page.request.get('/api/v1/brands')).json();
    brandId = brands.find((b: { name: string }) => b.name === brandName).id;
    const tile = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Edit ${brandName}` }) });
    await tile.getByRole('button', { name: 'Set as default' }).click();
    await expect(tile.getByText('Default', { exact: true })).toBeVisible();
  });

  test('a new template takes the default brand', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('takes default') });
    await page.goto(`/templates/${id}`);
    await expect(page.getByRole('button', { name: 'Brand' })).toHaveText(brandName);
    // The row is the proof that the adoption was autosaved, not the word
    // "Saved": the status keeps that word in the DOM at opacity 0 while idle,
    // which Playwright counts as visible.
    await expect.poll(async () => {
      const theme = (await api.getTemplate(id)).theme;
      return theme ? JSON.parse(theme).button?.backgroundColor?.toUpperCase() : null;
    }).toBe('#B25D38');
  });

  test('deleting the default hands it on', async ({ page, api }) => {
    api.trackBrand(brandId);
    await page.goto('/dashboard/brands');
    await page.getByRole('button', { name: `Delete ${brandName}` }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this brand?' });
    await expect(dialog.getByText('It’s your default')).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Brand deleted')).toBeVisible();
    await expect(page.getByRole('button', { name: `Edit ${brandName}` })).toHaveCount(0);
    await expect(page.getByText('Default', { exact: true })).toHaveCount(1);
  });
});
