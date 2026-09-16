import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';

// Below `sm` the editor is the phone shell: the subject lives in the "Email
// details" sheet behind the header's subject button, and the save status
// sits inside the ⋯ menu rather than in a toolbar. The same three tests run
// on both projects; only the way to the subject and to "Saved" differs.
const onPhone = () => test.info().project.name.startsWith('phone');

/** The subject field, opened first when it sits behind the details sheet. */
async function subjectField(page: Page) {
  if (onPhone() && !(await page.getByRole('dialog', { name: 'Email details' }).isVisible())) {
    await page.getByRole('button', { name: /^Edit details:/ }).click();
  }
  return page.getByRole('textbox', { name: 'Subject' });
}

/**
 * Types a subject and waits until it is on the server. "Saved" alone is not
 * proof: a template fresh from the gallery autosaves once on mount, so the
 * word can already be up before this edit's debounce has fired, and leaving
 * then would abandon it. The save that carries this title is the signal;
 * the word is what the customer reads afterwards.
 */
async function renameTo(page: Page, id: string, title: string) {
  const subject = await subjectField(page);
  const saved = page.waitForResponse(
    (res) => res.request().method() === 'POST' && res.url().endsWith(`/api/v1/templates/${id}`) && res.request().postDataJSON()?.title === title && res.ok(),
  );
  await subject.fill(title);
  await subject.blur();
  await saved;
  if (onPhone()) {
    await page.getByRole('dialog', { name: 'Email details' }).getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'More', exact: true }).click();
  }
  // "Not saved" would also match a loose pattern; the word alone is the pass.
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
}

test.describe('templates', () => {
  test('a new template appears in the list', async ({ page, api, name }) => {
    await page.goto('/dashboard/templates');
    // An empty list draws a second "New template" in its empty state; both
    // open the same gallery.
    await page.getByRole('button', { name: 'New template' }).first().click();
    const gallery = page.getByRole('dialog', { name: 'Start a template' });
    await gallery.getByRole('button', { name: /^Start from/ }).first().click();
    await expect(page).toHaveURL(/\/templates\/[0-9a-f-]{36}$/);
    const id = page.url().split('/').pop()!;
    // Handed to the fixture at once: a failure below would otherwise leave
    // the row behind for the rest of the run.
    api.track(id);
    // Name it so the list shows a row this test owns.
    await renameTo(page, id, name('new'));
    await page.goto('/dashboard/templates');
    await expect(page.getByRole('link', { name: name('new') })).toBeVisible();
  });

  test('a seeded template can be renamed', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('seeded') });
    await page.goto(`/templates/${t.id}`);
    // The server-rendered page already shows the subject, but typing into
    // it before the page is live is lost. The body is drawn only once the
    // editor has mounted, so its text (from EMPTY_DOC) is the sign to wait for.
    await expect(page.getByText('Hello from e2e')).toBeVisible();
    await expect(await subjectField(page)).toHaveValue(name('seeded'));
    await renameTo(page, t.id, name('renamed'));
    await page.reload();
    await expect(await subjectField(page)).toHaveValue(name('renamed'));
  });

  test('deleting asks first, then removes the row', async ({ page, api, name }) => {
    const t = await api.createTemplate({ title: name('doomed') });
    await page.goto('/dashboard/templates');
    const row = page.getByRole('listitem').filter({ hasText: name('doomed') });
    await row.getByRole('button', { name: 'Delete template' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this template?' });
    await expect(dialog).toContainText('This cannot be undone.');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(name('doomed'))).toHaveCount(0);
    // Already gone; the fixture's cleanup tolerates 404.
  });
});
