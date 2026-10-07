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
