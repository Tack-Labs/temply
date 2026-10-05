import type { Page } from '@playwright/test';
import { EMPTY_DOC } from '../fixtures/api';
import { renameTo, subjectField } from '../fixtures/editor';
import { templateLink } from '../fixtures/list';
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

  test('deleting hands keyboard focus to the row left behind', async ({ page, api, name }) => {
    const stem = name('focus');
    await api.createTemplate({ title: `${stem} one` });
    await api.createTemplate({ title: `${stem} two` });
    await page.goto('/dashboard/templates');
    // Narrowed to the pair: with two rows, whichever goes, the other is the
    // one focus must land on, so the test does not depend on their order.
    await page.getByRole('searchbox', { name: 'Search templates' }).fill(stem);
    const doomed = page.getByRole('listitem').filter({ hasText: `${stem} two` });
    await doomed.getByRole('button', { name: /^Delete template/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this template?' });
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(templateLink(page, `${stem} two`)).toHaveCount(0);
    await expect(templateLink(page, `${stem} one`)).toBeFocused();
  });

  test('search narrows the list to what matches', async ({ page, api, name }) => {
    const needle = name('needle');
    const other = name('other');
    await api.createTemplate({ title: needle });
    await api.createTemplate({ title: other });
    await page.goto('/dashboard/templates');
    const search = page.getByRole('searchbox', { name: 'Search templates' });
    await search.fill(needle);
    await expect(templateLink(page, needle)).toBeVisible();
    await expect(templateLink(page, other)).toHaveCount(0);
    await search.fill('zzzz-nothing-is-called-this');
    await expect(page.getByText('No templates match')).toBeVisible();
    // Two ways out of the no-match state, and they used to share a name —
    // "Clear search" both for the × in the box and for the button in the
    // empty state, which is a list a reader cannot choose from. The × keeps
    // the name of the action; the empty state is named for what the reader
    // is after.
    await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Show all templates' }).click();
    await expect(templateLink(page, other)).toBeVisible();
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
    const copy = templateLink(page, `[DUPLICATE] ${title}`);
    await expect(copy).toBeVisible();
    api.track((await copy.getAttribute('href'))!.split('/').pop()!);
  });

  // The rest share a shape. The database holds every other test's rows at the
  // same moment, so none of them can count on the whole list: each searches for
  // its own stem first, which narrows the filter's counts to its own rows too.
  // A template made through the API is born published, and a draft saved over
  // it is what leaves changes waiting.
  test.describe('filter', () => {
    const filterOf = (page: Page) => page.getByRole('radiogroup', { name: 'Filter templates' });
    const countOf = (page: Page) =>
      page.getByRole('status').filter({ hasText: /\d+ (of \d+ )?templates?$/ });

    test('counts what is published and what has changes waiting, and narrows to either', async ({ page, api, name }) => {
      const stem = name('filter');
      const live = `${stem} live`;
      const changed = `${stem} edited`;
      await api.createTemplate({ title: live });
      const { id } = await api.createTemplate({ title: changed });
      await api.saveDraft(id, { title: changed, content: EMPTY_DOC });
      await page.goto('/dashboard/templates');
      await page.getByRole('searchbox', { name: 'Search templates' }).fill(stem);

      const filter = filterOf(page);
      await expect(filter.getByRole('radio', { name: /^All\s*,\s*2$/ })).toBeChecked();
      await expect(filter.getByRole('radio', { name: /^Published\s*,\s*1$/ })).toBeVisible();
      await expect(filter.getByRole('radio', { name: /^Drafts\s*,\s*1$/ })).toBeVisible();
      await expect(countOf(page)).toHaveText(/^2( of \d+)? templates$/);

      const liveRow = page.getByRole('listitem').filter({ hasText: live });
      const changedRow = page.getByRole('listitem').filter({ hasText: changed });
      await expect(liveRow.getByText('Published', { exact: true })).toBeVisible();
      await expect(changedRow.getByText('Unpublished changes')).toBeVisible();
      await expect(changedRow.getByText('Published', { exact: true })).toHaveCount(0);

      await filter.getByRole('radio', { name: /^Drafts/ }).click();
      await expect(changedRow).toBeVisible();
      await expect(liveRow).toHaveCount(0);
      await expect(countOf(page)).toHaveText(/^1 of \d+ templates$/);

      await filter.getByRole('radio', { name: /^Published/ }).click();
      await expect(liveRow).toBeVisible();
      await expect(changedRow).toHaveCount(0);

      await filter.getByRole('radio', { name: /^All/ }).click();
      await expect(liveRow).toBeVisible();
      await expect(changedRow).toBeVisible();
    });

    test('keeps the filter and its row actions on screen at any width', async ({ page, api, name }) => {
      const stem = name('fits');
      await api.createTemplate({ title: `${stem} a title long enough that it must be cut rather than push the actions off the edge` });
      await page.goto('/dashboard/templates');
      await page.getByRole('searchbox', { name: 'Search templates' }).fill(stem);
      const row = page.getByRole('listitem').filter({ hasText: stem });
      await expect(row).toBeVisible();

      const width = page.viewportSize()!.width;
      const filter = await filterOf(page).boundingBox();
      const remove = await row.getByRole('button', { name: 'Delete template' }).boundingBox();
      expect(filter!.x + filter!.width).toBeLessThanOrEqual(width);
      expect(remove!.x + remove!.width).toBeLessThanOrEqual(width);
    });

    test('combines with the search', async ({ page, api, name }) => {
      const stem = name('combined');
      const live = `${stem} live`;
      const changed = `${stem} edited`;
      await api.createTemplate({ title: live });
      const { id } = await api.createTemplate({ title: changed });
      await api.saveDraft(id, { title: changed, content: EMPTY_DOC });
      await page.goto('/dashboard/templates');

      await filterOf(page).getByRole('radio', { name: /^Drafts/ }).click();
      await page.getByRole('searchbox', { name: 'Search templates' }).fill(stem);
      await expect(templateLink(page, changed)).toBeVisible();
      await expect(templateLink(page, live)).toHaveCount(0);
      await expect(countOf(page)).toHaveText(/^1 of \d+ templates$/);

      // The search is cleared and the filter stays: the × undoes one thing.
      await page.getByRole('button', { name: 'Clear search' }).click();
      await expect(filterOf(page).getByRole('radio', { name: /^Drafts/ })).toBeChecked();
    });

    test('says so when a filter holds nothing, and offers the way back', async ({ page, api, name }) => {
      const stem = name('none');
      await api.createTemplate({ title: `${stem} one` });
      await api.createTemplate({ title: `${stem} two` });
      await page.goto('/dashboard/templates');
      await page.getByRole('searchbox', { name: 'Search templates' }).fill(stem);

      const filter = filterOf(page);
      await expect(filter.getByRole('radio', { name: /^Drafts\s*,\s*0$/ })).toBeVisible();
      await filter.getByRole('radio', { name: /^Drafts/ }).click();
      await expect(page.getByText('No templates match')).toBeVisible();
      await expect(page.getByText(/Nothing under Drafts matches/)).toBeVisible();
      await expect(templateLink(page, `${stem} one`)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCount(1);

      await page.getByRole('button', { name: 'Show all templates' }).click();
      await expect(filter.getByRole('radio', { name: /^All/ })).toBeChecked();
      await expect(page.getByRole('searchbox', { name: 'Search templates' })).toHaveValue('');
      await expect(templateLink(page, `${stem} one`)).toBeVisible();
    });
  });
});
