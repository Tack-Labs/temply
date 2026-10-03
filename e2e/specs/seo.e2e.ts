import { expect, test } from '@playwright/test';

const origin = 'https://temply.tacklabs.co.uk';
const publicPaths = ['/', '/docs', '/playground', '/terms', '/privacy'];

for (const path of publicPaths) {
  test(`${path} has public search and social metadata`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/^.{10,60}$/);
    const title = await page.title();
    expect(title.endsWith(' | Temply')).toBe(true);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /^.{50,155}$/);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toHaveCount(1);
    await expect(footer.getByRole('navigation', { name: 'Site links' })).toBeVisible();
    for (const name of ['Docs', 'Try the editor', 'Pricing', 'Contact', 'Terms', 'Privacy']) {
      await expect(footer.getByRole('link', { name, exact: true })).toBeVisible();
    }
    const canonical = `${origin}${path === '/' ? '' : path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', title);
    const copy = await description.getAttribute('content');
    expect(copy).not.toBeNull();
    expect(await page.locator('meta[property="og:description"]').getAttribute('content')).toBe(copy);
    expect(await page.locator('meta[name="twitter:description"]').getAttribute('content')).toBe(copy);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${origin}/temply-email-editor.png`);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(scripts.length).toBeGreaterThan(0);
    for (const json of scripts) {
      expect(() => JSON.parse(json)).not.toThrow();
      expect(json).not.toContain('maily.to');
      expect(json).toContain(origin);
    }
  });
}

test('each public page has its own title and description', async ({ request }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const path of publicPaths) {
    const html = await (await request.get(path)).text();
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/u)?.[1];
    expect(title).toBeDefined();
    expect(description).toBeDefined();
    if (title) titles.add(title);
    if (description) descriptions.add(description);
  }
  expect(titles.size).toBe(publicPaths.length);
  expect(descriptions.size).toBe(publicPaths.length);
});

for (const path of ['/dashboard', '/templates/example', '/onboarding', '/login', '/sign-up', '/p/missing-preview']) {
  test(`${path} sends noindex before sign-in`, async ({ playwright, baseURL }) => {
    const visitor = await playwright.request.newContext({ baseURL });
    try {
      const response = await visitor.get(path, { maxRedirects: 0 });
      expect(response.headers()['x-robots-tag']).toContain('noindex');
    } finally {
      await visitor.dispose();
    }
  });
}

test('the sitemap lists canonical public pages and allows noindex to be read', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(locations.sort()).toEqual(publicPaths.map((path) => `${origin}${path === '/' ? '' : path}`).sort());
  expect([...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)]).toHaveLength(publicPaths.length);
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(robots).not.toContain('Disallow: /dashboard');
  expect(robots).not.toContain('Disallow: /templates');
  expect(robots).toContain('Disallow: /api/');
});

test('the Temply social image has the declared dimensions and replaces the old URL', async ({ request }) => {
  const image = await request.get('/temply-email-editor.png');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');
  const png = await image.body();
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  const cover = await request.get('/temply-email-editor.webp');
  expect(cover.status()).toBe(200);
  expect(cover.headers()['content-type']).toContain('image/webp');
  const old = await request.get('/og-image.png', { maxRedirects: 0 });
  expect(old.status()).toBe(301);
  expect(old.headers().location).toBe('/temply-email-editor.png');
});

test('a missing public page returns 404', async ({ page }) => {
  const response = await page.goto('/no-such-public-page');
  expect(response?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
});
