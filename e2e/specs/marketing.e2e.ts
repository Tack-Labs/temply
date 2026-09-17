import { test, expect } from '@playwright/test';

test.describe('marketing', () => {
  test('the home page loads and links to the docs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Temply/);
    // The hero's link to the docs page reads "Documentation", not "Docs".
    await page.getByRole('link', { name: 'Documentation' }).first().click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();
  });

  test('every docs nav link has a section', async ({ page }) => {
    await page.goto('/docs');
    const links = page.getByRole('navigation', { name: /contents|on this page/i }).getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThan(5);
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).toMatch(/^#/);
      await expect(page.locator(href!)).toHaveCount(1);
    }
  });

  test('the page never scrolls sideways', async ({ page }) => {
    for (const path of ['/', '/docs', '/playground']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${path} scrolls horizontally`).toBe(false);
    }
  });

  test('the playground opens the editor for a visitor', async ({ browser }) => {
    // A fresh context with no storageState: the playground is the one editor
    // a signed-out visitor can reach, and the project's `page` is signed in.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/playground');
    // The phone shell has no Content section; its floating "Add block" button
    // is the mark that the editor mounted.
    const phone = test.info().project.name.startsWith('phone');
    if (phone) await expect(page.getByRole('button', { name: 'Add block' })).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
    await expect(page.locator('.ProseMirror')).toContainText('Welcome to Temply');
    await context.close();
  });

  test('the legal pages link to each other', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Terms of service' }).click();
    await expect(page.getByRole('heading', { name: 'Terms of service', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Privacy policy' }).click();
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
  });

  test('docs code tabs switch the language and remember it', async ({ page }) => {
    await page.goto('/docs');
    // Each CodeTabs is the box whose header holds the Language tablist and
    // whose code block is a direct child. The page's first <pre> is not one
    // of them: plain example blocks come before the first switchable one.
    const blocks = page.locator('div:has(> div > [role="tablist"][aria-label="Language"])');
    const first = blocks.first();
    await first.getByRole('tab', { name: 'JavaScript' }).click();
    await expect(first.getByRole('tab', { name: 'JavaScript' })).toHaveAttribute('aria-selected', 'true');
    await expect(first.locator('pre')).toContainText('fetch(');
    await expect(first.locator('pre')).not.toContainText('curl ');
    // The choice is read from storage on mount only, so the other blocks
    // follow on reload rather than live.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'JavaScript', selected: true })).toHaveCount(3);
  });
});
