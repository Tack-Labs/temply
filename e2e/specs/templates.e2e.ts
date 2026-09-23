import { renameTo, subjectField } from '../fixtures/editor';
import { test, expect } from '../fixtures/test';

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
    await api.createTemplate({ title: name('doomed') });
    await page.goto('/dashboard/templates');
    const row = page.getByRole('listitem').filter({ hasText: name('doomed') });
    await row.getByRole('button', { name: 'Delete template' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this template?' });
    await expect(dialog).toContainText('This cannot be undone.');
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(name('doomed'))).toHaveCount(0);
    // Already gone; the fixture's cleanup tolerates 404.
  });

  test('search narrows the list to what matches', async ({ page, api, name }) => {
    const needle = name('needle');
    const other = name('other');
    await api.createTemplate({ title: needle });
    await api.createTemplate({ title: other });
    await page.goto('/dashboard/templates');
    const search = page.getByRole('searchbox', { name: 'Search templates' });
    await search.fill(needle);
    await expect(page.getByRole('link', { name: needle })).toBeVisible();
    await expect(page.getByRole('link', { name: other })).toHaveCount(0);
    await search.fill('zzzz-nothing-is-called-this');
    await expect(page.getByText('No templates match')).toBeVisible();
    // Two ways out of the no-match state, and they used to share a name —
    // "Clear search" both for the × in the box and for the button in the
    // empty state, which is a list a reader cannot choose from. The × keeps
    // the name of the action; the empty state is named for what the reader
    // is after.
    await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Show all templates' }).click();
    await expect(page.getByRole('link', { name: other })).toBeVisible();
  });

  test('duplicating makes a copy named after the original', async ({ page, api, name }) => {
    const title = name('original');
    await api.createTemplate({ title });
    await page.goto('/dashboard/templates');
    // Narrowed to the one tile so its Duplicate is the only one on the page;
    // other tests' tiles are in the same list at the same time.
    await page.getByRole('searchbox', { name: 'Search templates' }).fill(title);
    await page.getByRole('button', { name: 'Duplicate template' }).click();
    await expect(page.getByText('Template duplicated')).toBeVisible();
    const copy = page.getByRole('link', { name: `[DUPLICATE] ${title}` });
    await expect(copy).toBeVisible();
    api.track((await copy.getAttribute('href'))!.split('/').pop()!);
  });
});
