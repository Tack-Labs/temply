import type { Page } from '@playwright/test';
import { EMPTY_DOC } from '../fixtures/api';
import { onPhone } from '../fixtures/project';
import { test, expect } from '../fixtures/test';

// The dashboard home, read where a signed-in customer meets it. The page's
// data is fetched on the server, which a page.route cannot intercept, so what
// is read here is the shared workspace as it is: Enterprise, a count and no
// bar. The states the browser cannot arrange (a failed fetch, a lapsed plan,
// an empty account, a bar near its limit) are drawn from plain props in the
// unit tests beside usage-section.tsx and recent-templates.tsx.

const usage = (page: Page) => page.getByRole('region', { name: 'Usage' });
const recent = (page: Page) => page.getByRole('region', { name: 'Recent templates' });
const rowFor = (page: Page, title: string) => recent(page).getByRole('listitem').filter({ hasText: title });

// The home lists only the five most recently touched. Both browser projects
// and every other spec write to the one workspace at once (the editor specs
// alone make dozens of templates and autosave into them), so five other
// writes can land between a test's seed and the page's own read, and a
// template that was made a moment ago is then not on the page at all. No
// wait brings it back. A test that needs its template listed therefore makes
// it again, under a name of its own, rather than waiting on one that has
// fallen out; and a test that compares two templates reads only the rows that
// are there. Seeding in the middle of the test would not help: what is shown
// is decided when the page is rendered.

/**
 * Seeds, opens the home and waits for the row of `leads`, the template made
 * last. When that row is not there it seeds again, with the attempt's number
 * in the names so the earlier try's rows cannot answer to the new one; the
 * earlier try's templates are left to the test's cleanup.
 */
async function openHomeWith<T>(
  page: Page,
  seed: (attempt: number) => Promise<T>,
  leads: (made: T) => string,
): Promise<T> {
  let attempt = 0;
  let made!: T;
  await expect(async () => {
    made = await seed(++attempt);
    await page.goto('/dashboard');
    await expect(rowFor(page, leads(made))).toBeVisible();
  }).toPass({ timeout: 30_000 });
  return made;
}

test.describe('the dashboard home', () => {
  test('greets the reader and opens on usage, then recent templates', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: /^Welcome back/ })).toBeVisible();
    await expect(usage(page)).toBeVisible();
    await expect(recent(page)).toBeVisible();
  });

  test('gives an Enterprise workspace its usage as counts, with no bar to fill', async ({ page }) => {
    await page.goto('/dashboard');
    const section = usage(page);
    await expect(section.getByText('Live API calls this month')).toBeVisible();
    await expect(section.getByText('Templates', { exact: true })).toBeVisible();
    // Nothing caps either, so there is no ceiling to draw a bar against.
    await expect(section.getByText('no limit')).toHaveCount(2);
    await expect(section.getByRole('progressbar')).toHaveCount(0);
    // Membership is still a count even when the plan has no usage ceiling.
    await expect(section.getByText('Members', { exact: true })).toBeVisible();
  });

  test('lists a new template with its status and when it was edited, and opens it', async ({ page, api, name }) => {
    const t = await openHomeWith(
      page,
      (attempt) => api.createTemplate({ title: name(`recent #${attempt}`), previewText: 'Shown under the title' }),
      (made) => made.title,
    );

    const row = rowFor(page, t.title);
    await expect(row).toBeVisible();
    await expect(row.getByText('Shown under the title')).toBeVisible();
    // A template made through the API is already published.
    await expect(row.getByText('Published', { exact: true })).toBeVisible();
    // "Edited", never "Published {date}": the badge says which, and a draft
    // has an edit date and no publish one.
    await expect(row.getByText(/^Edited/)).toBeVisible();
    await expect(row.getByText(/^Published \S/)).toHaveCount(0);
    await expect(row.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);

    const link = row.getByRole('link', { name: t.title });
    await expect(link).toHaveAttribute('href', `/templates/${t.id}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/templates/${t.id}$`));
  });

  test('says when a template has changes waiting, in the same words as the list', async ({ page, api, name }) => {
    const t = await openHomeWith(
      page,
      async (attempt) => {
        const made = await api.createTemplate({ title: name(`changed #${attempt}`) });
        await api.saveDraft(made.id, { title: made.title, content: EMPTY_DOC });
        return made;
      },
      (made) => made.title,
    );

    const row = rowFor(page, t.title);
    await expect(row.getByText('Unpublished changes')).toBeVisible();
    await expect(row.getByText('Published', { exact: true })).toHaveCount(0);
  });

  test('puts the template touched last first', async ({ page, api, name }) => {
    const { older, newer } = await openHomeWith(
      page,
      async (attempt) => ({
        older: await api.createTemplate({ title: name(`older #${attempt}`) }),
        newer: await api.createTemplate({ title: name(`newer #${attempt}`) }),
      }),
      ({ newer }) => newer.title,
    );

    // Other tests make rows in the same workspace, so the two are compared
    // with each other rather than with a position on the page. The older one
    // may have been pushed off the five by now, which is the order proved as
    // well as any position could: only a row that is listed is compared.
    const rows = await recent(page).getByRole('listitem').allTextContents();
    const at = (title: string) => rows.findIndex((text) => text.includes(title));
    const newerAt = at(newer.title);
    const olderAt = at(older.title);
    expect(newerAt, 'the newer template is not listed').toBeGreaterThanOrEqual(0);
    if (olderAt >= 0) expect(olderAt, 'the older template is listed above the newer').toBeGreaterThan(newerAt);
  });

  test('"View all" goes to the whole list', async ({ page, api, name }) => {
    // The link is drawn only when there is something to view, which a
    // workspace the other specs have emptied may not have.
    await api.createTemplate({ title: name('viewall') });
    await page.goto('/dashboard');
    await recent(page).getByRole('link', { name: 'View all', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/templates$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Templates' })).toBeVisible();
  });

  test('lays out for the width it has, and nothing scrolls sideways', async ({ page, api, name }) => {
    await api.createTemplate({ title: name('layout') });
    await page.goto('/dashboard');
    await expect(usage(page)).toBeVisible();

    const main = page.locator('#main-content');
    expect(await main.evaluate((el) => el.scrollWidth <= el.clientWidth), 'the page scrolls sideways').toBe(true);

    // The two tiles sit side by side where there is room for them and stack
    // where there is not, measured by their labels.
    const calls = (await usage(page).getByText('Live API calls this month').boundingBox())!;
    const templates = (await usage(page).getByText('Templates', { exact: true }).boundingBox())!;
    if (onPhone()) {
      expect(templates.y).toBeGreaterThan(calls.y);
      expect(Math.abs(templates.x - calls.x)).toBeLessThan(2);
    } else {
      expect(Math.abs(templates.y - calls.y)).toBeLessThan(2);
      expect(templates.x).toBeGreaterThan(calls.x);
    }
  });

  test('keeps its controls a touch target tall on a phone', async ({ page, api, name }) => {
    test.skip(!onPhone(), 'the touch sizing is the phone project’s: it emulates a coarse pointer');
    await api.createTemplate({ title: name('touch') });
    await page.goto('/dashboard');

    for (const control of [
      page.locator('#main-content').getByRole('button', { name: 'New template' }).first(),
      recent(page).getByRole('link', { name: 'View all', exact: true }),
    ]) {
      await expect(control).toBeVisible();
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
