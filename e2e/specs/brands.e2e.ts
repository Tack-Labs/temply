import { test, expect } from '../fixtures/test';

const PRESETS = ['Classic', 'Minimal', 'Corporate', 'Warm', 'Slate'];

test.describe('brands', () => {
  test('the five presets are on offer', async ({ page }) => {
    await page.goto('/dashboard/brands');
    for (const preset of PRESETS) await expect(page.getByRole('button', { name: `Preview ${preset}` })).toBeVisible();
  });

  test('a brand starts from a preset', async ({ page, api, name }) => {
    const title = name('warm');
    await page.goto('/dashboard/brands');
    // An empty "Your brands" draws a second "New brand" in its empty state;
    // both open the same dialog.
    await page.getByRole('button', { name: 'New brand' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create brand' });
    await dialog.getByRole('textbox', { name: 'Brand name' }).fill(title);
    await dialog.getByRole('button', { name: 'Warm', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Warm', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Brand created')).toBeVisible();
    await expect(page.getByRole('button', { name: `Edit ${title}` })).toBeVisible();
    const brand = await api.brandNamed(title);
    api.trackBrand(brand.id);
    // The button fill is the colour the Warm preset is known by.
    expect(JSON.parse(brand.theme).button?.backgroundColor?.toUpperCase()).toBe('#B25D38');
  });

  test('the two Background swatches are told apart by name', async ({ page, api, name }) => {
    const title = name('backgrounds');
    await page.goto('/dashboard/brands');
    await page.getByRole('button', { name: 'New brand' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create brand' });
    await dialog.getByRole('textbox', { name: 'Brand name' }).fill(title);
    await dialog.getByRole('button', { name: 'Advanced' }).click();

    // Page and Card both show a swatch labelled "Background", and the heading
    // that tells them apart is not part of either name. A swatch is a
    // decorative square beside a hex value, so one that falls back to its own
    // text announces itself as "#FFFFFF": the name has to carry the group.
    await expect(dialog.getByLabel('Page background', { exact: true })).toBeVisible();
    await dialog.getByLabel('Card background', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Card background hex value' }).fill('#123456');
    await page.keyboard.press('Escape');

    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Brand created')).toBeVisible();
    const brand = await api.brandNamed(title);
    api.trackBrand(brand.id);
    const theme = JSON.parse(brand.theme);
    expect(theme.container?.backgroundColor?.toUpperCase(), 'the Card swatch is the one that moved').toBe('#123456');
    expect(theme.body?.backgroundColor?.toUpperCase(), 'the Page swatch is left alone').not.toBe('#123456');
  });

  test('a colour that is hard to read is flagged before it is saved', async ({ page }) => {
    await page.goto('/dashboard/brands');
    await page.getByRole('button', { name: 'New brand' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Create brand' });
    await dialog.getByRole('button', { name: 'Advanced' }).click();
    // Each colour is a swatch-and-hex button named by the label beside it;
    // the popover it opens carries the hex field.
    await dialog.getByLabel('Link', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Link hex value' }).fill('#FFFFFF');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Link hex value' })).toBeHidden();
    await dialog.getByRole('button', { name: 'This colour may be hard to read — details' }).click();
    await expect(page.getByText('Hard to read with this colour')).toBeVisible();
    await expect(page.getByText(/^Links sit at/)).toBeVisible();
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  });
});
