import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { onPhone, renameTo, openMore, publish } from '../fixtures/editor';

/**
 * Publishes, waits for the server to have kept the version, and reads the
 * toast. The response is the proof the publish landed: the toast from the
 * previous publish can still be on screen (sonner keeps one up for 4 s), so
 * the word alone could be that one, and `.first()` only says the customer
 * saw it. The toolbar's own label carries a date, so the bare word is a
 * toast. `renameTo` on the phone leaves the ⋯ menu open, and `publish`
 * opens that menu itself; a second tap on ⋯ would close it, so it is put
 * away first.
 */
async function publishAndSee(page: Page, id: string) {
  if (onPhone()) await page.keyboard.press('Escape');
  const published = page.waitForResponse(
    (res) => res.request().method() === 'POST' && res.url().endsWith(`/api/v1/templates/${id}/publish`) && res.ok(),
  );
  await publish(page);
  await published;
  await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();
}

test.describe('version history', () => {
  test('each publish keeps a version, and one can be restored', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('versions') });
    const first = name('first');
    const second = name('second');
    await page.goto(`/templates/${id}`);
    // Typing into the subject before the editor is live is lost; the body
    // is drawn only once it has mounted, so its text is the sign to wait for.
    await expect(page.locator('.ProseMirror').getByText('Hello from e2e')).toBeVisible();

    await renameTo(page, id, first);
    await publishAndSee(page, id);
    await renameTo(page, id, second);
    await publishAndSee(page, id);

    if (onPhone()) {
      await openMore(page);
      await page.getByRole('menuitem', { name: 'History' }).click();
    } else {
      await page.getByRole('button', { name: 'History' }).click();
    }
    const dialog = page.getByRole('dialog', { name: 'Version history' });
    await expect(dialog.getByRole('button', { name: 'Preview version 2' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Preview version 1' })).toBeVisible();

    // Restore asks nothing; the toast and the draft's title are what change.
    // The open canvas may not repaint until a reload, so the title is read
    // back through the API rather than off the page.
    const row = dialog.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Preview version 1' }) });
    await row.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Version restored successfully.')).toBeVisible();
    await expect.poll(async () => (await api.getTemplate(id)).title).toBe(first);
  });
});
