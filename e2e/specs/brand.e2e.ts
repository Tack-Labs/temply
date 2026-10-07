import { expect, test } from '@playwright/test';

/** A PNG's width and height, from its IHDR chunk. */
const dimensions = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

test.describe('brand icons', () => {
  // Chrome and Firefox take the SVG; Safari ignores an SVG favicon and shows
  // no tab icon without a PNG, so the head has to carry both.
  test('the head links an SVG favicon and a PNG one, and both are served', async ({ page, request }) => {
    await page.goto('/');
    for (const [type, contentType] of [
      ['image/svg+xml', 'image/svg+xml'],
      ['image/png', 'image/png'],
    ]) {
      const link = page.locator(`link[rel="icon"][type="${type}"]`);
      await expect(link).toHaveCount(1);
      const icon = await request.get((await link.getAttribute('href'))!);
      expect(icon.status(), `the ${type} favicon`).toBe(200);
      expect(icon.headers()['content-type']).toContain(contentType);
    }
  });

  test('the touch icon is a 180 by 180 PNG', async ({ page, request }) => {
    await page.goto('/');
    const icon = await request.get((await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'))!);
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toContain('image/png');
    expect(dimensions(await icon.body())).toEqual([180, 180]);
  });

  test('the manifest lists a 192 and a 512 icon, and each is a PNG of that size', async ({ request }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    const { icons } = (await manifest.json()) as { icons: { src: string; sizes: string; type: string }[] };

    const pngs = icons.filter((icon) => icon.type === 'image/png');
    expect(pngs.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512']);
    for (const icon of pngs) {
      const file = await request.get(icon.src);
      expect(file.status(), icon.src).toBe(200);
      expect(file.headers()['content-type']).toContain('image/png');
      const edge = Number.parseInt(icon.sizes, 10);
      expect(dimensions(await file.body()), icon.src).toEqual([edge, edge]);
    }

    const svg = icons.find((icon) => icon.type === 'image/svg+xml');
    expect(svg?.sizes).toBe('any');
    const file = await request.get(svg!.src);
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toContain('image/svg+xml');
  });

  // The satori routes these were drawn by are gone. A 404 here is what stops
  // one being added back beside the files that replaced it.
  test('the old generated icon routes no longer exist', async ({ request }) => {
    for (const path of ['/icon-192', '/icon-512']) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});

test.describe('the mark and the lockup in the app', () => {
  // Signed out: someone signed in is sent past /login, so the screen under
  // test would never show.
  test.use({ storageState: { cookies: [], origins: [] } });

  // A mark that stopped sizing by height would be square again, and a lockup
  // whose file 404s has a natural width of 0; neither shows in a unit test.
  test('the 404 page draws the gradient mark 32px tall, in its 9:8 shape', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    const mark = page.locator('svg[viewBox="0 0 360 320"]');
    await expect(mark).toHaveCount(1);
    const box = (await mark.boundingBox())!;
    expect(box.height).toBeCloseTo(32, 0);
    expect(box.width).toBeCloseTo(36, 0);
    await expect(mark.locator('path')).toHaveAttribute('fill', /^url\(#[\w-]+\)$/);
  });

  // The playground renders its wait state into the page, ahead of the editor's
  // code, so the loader a visitor first sees is in the response. The retired
  // mark was three rounded bars in a violet tile.
  test('the loader is the gradient app icon with the mark\'s three shapes', async ({ request }) => {
    const html = await (await request.get('/playground')).text();
    expect(html).toContain('Loading the editor…');
    const bars = html.match(/class="page-loading-bar"/g) ?? [];
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.length % 3).toBe(0);
    expect(html).toContain('viewBox="0 0 1024 1024"');
    expect(html).not.toContain('rx="3.5"');
  });

  test('the sign-in screen leads with the lockup as a link home, 35px tall and loaded', async ({ page }) => {
    // Clerk's card is not under test and waits on a host the run does not reach.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const home = page.getByRole('link', { name: 'Temply', exact: true });
    await expect(home).toHaveAttribute('href', '/');
    const shown = home.locator('img:visible');
    await expect(shown).toHaveCount(1);
    await expect.poll(() => shown.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    expect((await shown.boundingBox())?.height).toBeCloseTo(35, 0);
    expect((await home.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  });
});
