import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { onPhone, renameTo, openMore, publish } from '../fixtures/editor';

/**
 * Publishes and reads the toast. Only the toast is proof: the toolbar's own
 * label carries a date, so the bare word is the toast, and it is then waited
 * out so a second publish's word is never this one still on screen.
 * `renameTo` on the phone leaves the ⋯ menu open to read "Saved", and
 * `publish` opens that menu itself; a second tap on ⋯ would close it, so
 * it is put away first.
 */
async function publishAndSee(page: Page) {
  if (onPhone()) await page.keyboard.press('Escape');
  await publish(page);
  const toast = page.getByText('Published', { exact: true });
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 10_000 });
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
    await publishAndSee(page);
    await renameTo(page, id, second);
    await publishAndSee(page);

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
