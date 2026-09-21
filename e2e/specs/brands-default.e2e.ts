import { test, expect } from '../fixtures/test';

// One default per workspace: these run in order, in one worker, on one
// project (phone-chromium ignores the file), so nothing else moves the
// default while they look at it.
test.describe.configure({ mode: 'serial', retries: 0 });

test.describe('brand defaults', () => {
  let brandName = '';
  let brandId = '';

  test('a brand can be made the default', async ({ page, api, name }) => {
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
    brandId = (await api.brandNamed(brandName)).id;
    const tile = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Edit ${brandName}` }) });
    await tile.getByRole('button', { name: 'Set as default' }).click();
    await expect(tile.getByText('Default', { exact: true })).toBeVisible();
  });

  test('a new template takes the default brand', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('takes default') });
    await page.goto(`/templates/${id}`);
    // Exact: the Brand sheet's own colour swatch is named "Brand color", and a
    // substring match takes both.
    await expect(page.getByRole('button', { name: 'Brand', exact: true })).toHaveText(brandName);
    // The row carries the default from creation — the server writes it at
    // POST, before the editor has opened — and the editor labels that theme
    // with the brand's name rather than with the preset it was saved from.
    const { theme } = await api.getTemplate(id);
    expect(theme && JSON.parse(theme).button?.backgroundColor?.toUpperCase()).toBe('#B25D38');
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
    // The server deletes the row and then writes the handoff, in two steps:
    // a read between them sees a default that names no tile, so the count
    // is 0 for that moment. The count assertion retries until it holds.
    await expect(page.getByText('Default', { exact: true })).toHaveCount(1);
  });
});
