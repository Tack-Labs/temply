import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { PNG_1x1 } from '../fixtures/api';

const fileName = (what: string) => `${what}.png`;

/** The library page's file input has no label: the Upload button clicks it
 *  for the user, and a test hands it files directly. */
const fileInput = (page: Page) => page.locator('input[type=file]');

/** The fake ImageKit serves an upload from `/cdn/<fileId>/<name>`, so the
 *  file the API must delete is named by the asset's own URL. */
const imagekitFileId = (url: string) => url.match(/\/cdn\/([^/]+)\//)?.[1];

test.describe('assets', () => {
  test('an upload lands in the library', async ({ page, api, fakes, name }) => {
    const file = fileName(name('upload'));
    await page.goto('/dashboard/assets');
    await fileInput(page).setInputFiles({ name: file, mimeType: 'image/png', buffer: PNG_1x1 });
    await expect(page.getByText('Image uploaded')).toBeVisible();
    await expect(page.getByRole('button', { name: `Preview ${file}` })).toBeVisible();
    api.trackAsset((await api.assetNamed(file)).id);
    const uploads = (await fakes.requests('imagekit')).filter((r) => r.method === 'POST' && r.path === '/api/v1/files/upload');
    expect(uploads.some((r) => (r.body as { fileName?: string }).fileName === file)).toBe(true);
  });

  test('deleting removes it from the library and the host', async ({ page, api, fakes, name }) => {
    const { name: file, url } = await api.uploadAsset(fileName(name('delete')));
    await page.goto('/dashboard/assets');
    await page.getByRole('button', { name: `Delete ${file}` }).click();
    await page.getByRole('dialog', { name: `Delete "${file}"?` }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Image deleted')).toBeVisible();
    await expect(page.getByRole('button', { name: `Preview ${file}` })).toHaveCount(0);
    // Another test's cleanup deletes from the host too, so the request is
    // matched by this asset's file rather than by any delete at all.
    const path = `/api/v1/files/${imagekitFileId(url)}`;
    await expect.poll(async () => (await fakes.requests('imagekit')).some((r) => r.method === 'DELETE' && r.path === path)).toBe(true);
  });

  test('a library image goes into a template', async ({ page, api, name }) => {
    const { name: file } = await api.uploadAsset(fileName(name('insert')));
    // An image with no source is the block that offers the library; its alt
    // is what the placed image answers to afterwards.
    const doc = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: '', alt: 'Chosen image', title: '' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    });
    const { id } = await api.createTemplate({ title: name('insert'), content: doc });
    await page.goto(`/templates/${id}`);
    // A click on the desktop page before React has mounted is lost; the
    // canvas is drawn only once the editor is live.
    await expect(page.locator('.ProseMirror').getByText('after')).toBeVisible();
    await page.getByRole('button', { name: 'Choose from library' }).click();
    await page.getByRole('dialog', { name: 'Choose an image' }).getByRole('button', { name: `Use ${file}` }).click();
    const placed = page.locator('.ProseMirror').getByRole('img', { name: 'Chosen image' });
    await expect(placed).toBeVisible();
    await expect(placed).toHaveAttribute('src', /\/imagekit\/cdn\/.*\?tr=w-1200,q-80$/);
  });

  test('the wrong kind of file and an oversized one are refused', async ({ page, name }) => {
    await page.goto('/dashboard/assets');
    // The server decides the type from the bytes, not from the name or the
    // MIME the browser sends.
    await fileInput(page).setInputFiles({ name: fileName(name('text')), mimeType: 'image/png', buffer: Buffer.from('not a picture') });
    await expect(page.getByText('Only JPEG, PNG, GIF and WebP images can be uploaded.')).toBeVisible();
    const big = Buffer.concat([PNG_1x1, Buffer.alloc(6 * 1024 * 1024)]);
    await fileInput(page).setInputFiles({ name: fileName(name('big')), mimeType: 'image/png', buffer: big });
    await expect(page.getByText('Images must be under 5 MB.')).toBeVisible();
  });
});
