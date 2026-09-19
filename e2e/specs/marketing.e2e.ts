import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { onPhone } from '../fixtures/project';

test.describe('marketing', () => {
  test('the home page loads and links to the docs', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Temply/);
    // The hero's link to the docs page reads "Documentation", not "Docs".
    await page.getByRole('link', { name: 'Documentation' }).first().click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByRole('heading', { name: 'Introduction' })).toBeVisible();
  });

  test('a crawler is given the page in its own terms', async ({ page, request }) => {
    // Titles come from one template, the icons come in the formats each
    // browser takes, the manifest and the sitemap answer, and the front
    // page says what it is in schema.org's vocabulary.
    await page.goto('/');
    await expect(page).toHaveTitle('Temply — write the email, we handle the HTML');
    const graph = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(graph!)['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual(['Organization', 'SoftwareApplication']);
    await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

    for (const [path, title] of [['/docs', 'Documentation — Temply'], ['/playground', 'Playground — Temply'], ['/terms', 'Terms of service — Temply']]) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
    }

    // The policy is reported, not enforced, and names the Clerk host the
    // build was given; the report endpoint answers through the proxy.
    const csp = (await request.get('/')).headers()['content-security-policy-report-only'];
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).toContain('clerk.accounts.dev');
    expect(csp).toContain("frame-ancestors 'none'");
    const report = await request.post('/api/csp-report', {
      headers: { 'content-type': 'application/csp-report' },
      data: JSON.stringify({ 'csp-report': { 'effective-directive': 'img-src', 'blocked-uri': 'http://x', 'document-uri': '/' } }),
    });
    expect(report.status()).toBe(200);

    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    expect((await manifest.json()).name).toBe('Temply');
    const icon = await request.get('/apple-icon');
    expect(icon.headers()['content-type']).toBe('image/png');

    // Each page is dated by the last commit that touched what it is made
    // of, not by the deploy. The terms page is the probe: its sources are
    // the page and the legal facts, and git says when they last changed.
    const sitemap = await (await request.get('/sitemap.xml')).text();
    const entries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], new Date(m[2])] as const);
    expect(entries.length).toBe(5);
    const terms = entries.find(([loc]) => loc.endsWith('/terms'))![1];
    const committed = new Date(execFileSync('git', ['log', '-1', '--format=%cI', '--', 'app/(marketing)/terms', 'lib/legal.ts'], { cwd: join(import.meta.dirname, '..', '..', 'client'), encoding: 'utf8' }).trim());
    expect(terms.getTime()).toBe(committed.getTime());
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
    if (onPhone()) await expect(page.getByRole('button', { name: 'Add block' })).toBeVisible();
    else await expect(page.getByRole('heading', { name: 'Content', exact: true })).toBeVisible();
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
    // Only a JavaScript snippet contains `fetch(`, and until a reload only the
    // block whose tab was clicked shows one: the other two stay on curl. So
    // the page goes from no `fetch(` to exactly one, and loses one block that
    // starts with `curl `.
    const js = page.getByText(/fetch\(/);
    const curl = page.getByText(/^curl /);
    await expect(js).toHaveCount(0);
    const curlBefore = await curl.count();
    const first = page.getByRole('tablist', { name: 'Language' }).first();
    await first.getByRole('tab', { name: 'JavaScript' }).click();
    await expect(first.getByRole('tab', { name: 'JavaScript' })).toHaveAttribute('aria-selected', 'true');
    await expect(js).toHaveCount(1);
    await expect(curl).toHaveCount(curlBefore - 1);
    // The choice is read from storage on mount only, so the other blocks
    // follow on reload rather than live.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'JavaScript', selected: true })).toHaveCount(3);
  });
});
