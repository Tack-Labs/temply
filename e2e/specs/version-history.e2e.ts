import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { onPhone, renameTo, openMore, publish, subjectField } from '../fixtures/editor';

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

    // Restore asks nothing; the toast, the draft on the server and what is
    // on screen are what change. The screen is the half that used to wait
    // for a reload: the editor kept the document and the subject the restore
    // had just replaced, so the page said one thing and the row another.
    const row = dialog.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Preview version 1' }) });
    await row.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Version restored', { exact: true })).toBeVisible();
    await expect.poll(async () => (await api.getTemplate(id)).title).toBe(first);
    await expect(await subjectField(page), 'the open editor shows the restored subject without a reload').toHaveValue(first);
  });

  test('restoring a version written before a schema change keeps its content', async ({ page, api, name }) => {
    // A version is the row exactly as it stood, so it holds whatever the
    // editor was never asked to migrate — and restore puts one on a canvas
    // that is already live, with `setContent`. That fails the way a mount
    // fails: not with a throw and not by dropping the node, but with an empty
    // document. The autosave that follows a restore would then write the
    // blank over the row, and `template_versions` would be the only way back.
    //
    // Everything before the editor opens goes through the API on purpose. A
    // publish snapshots the row's own content, so a version seeded and
    // published from here keeps the stored shape byte for byte; anything
    // typed into the canvas first would have been migrated on the way in and
    // the version would hold the migrated shape instead.
    const stored = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Above the block' }] },
        { type: 'codeBlock', attrs: { language: 'html' }, content: [{ type: 'text', text: '<b>Stored code</b>' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Below the block' }] },
      ],
    });
    const title = name('old version');
    const { id } = await api.createTemplate({ title, content: stored });
    await api.publishTemplate(id);
    // A newer draft, so the restore has something to replace and the case can
    // tell it from a no-op.
    await api.saveDraft(id, {
      title,
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The newer draft' }] }],
      }),
    });

    await page.goto(`/templates/${id}`);
    const pm = page.locator('.ProseMirror');
    await expect(pm.getByText('The newer draft')).toBeVisible();

    if (onPhone()) {
      await openMore(page);
      await page.getByRole('menuitem', { name: 'History' }).click();
    } else {
      await page.getByRole('button', { name: 'History' }).click();
    }
    const dialog = page.getByRole('dialog', { name: 'Version history' });
    const row = dialog.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Preview version 1' }) });
    await row.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText('Version restored', { exact: true })).toBeVisible();

    // The block is the one the product has, and the paragraphs either side of
    // it are what say the document arrived whole rather than as the one empty
    // line a failed parse leaves behind.
    await expect(pm.getByText('Above the block')).toBeVisible();
    await expect(pm.getByText('Below the block')).toBeVisible();
    await expect(pm.locator('[data-type="htmlCodeBlock"]')).toHaveCount(1);
    await expect(pm.getByText('The newer draft')).toHaveCount(0);
  });
});
