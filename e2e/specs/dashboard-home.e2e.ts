import type { Page } from '@playwright/test';
import { EMPTY_DOC } from '../fixtures/api';
import { onPhone } from '../fixtures/project';
import { test, expect } from '../fixtures/test';

// The dashboard home, read where a signed-in customer meets it. The page's
// data is fetched on the server, which a page.route cannot intercept, so what
// is read here is the shared workspace as it is: Enterprise, a count and no
// bar. The states the browser cannot arrange (a failed fetch, a lapsed plan,
// an empty account, a bar near its limit) are drawn from plain props in the
// unit tests beside usage-section.tsx and recent-templates.tsx. The next-step
// banner is the exception: it is read from the templates, which this spec can
// seed, so it is proved here (and, since the workspace is shared, with the
// same re-seeding as the recent list).

const usage = (page: Page) => page.getByRole('region', { name: 'Usage' });
const starters = (page: Page) => page.getByRole('region', { name: 'Start from a starter' });
const nextStep = (page: Page) => page.getByRole('region', { name: 'Next step' });
const doc = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
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

/**
 * Opens the home once the page is live. The starters are in the server's
 * HTML, and a click before React has attached its handler is dropped without
 * a request. The usage section's reset date is the reader's locale, so it is
 * drawn only once the page has hydrated, and its being there is the sign that
 * a click will land.
 */
async function openHome(page: Page) {
  await page.goto('/dashboard');
  await expect(usage(page).getByText(/^Resets /)).toBeVisible();
}

test.describe('the dashboard home', () => {
  test('greets the reader, then starters, recent templates and usage, in that order', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: /^Welcome back/ })).toBeVisible();
    await expect(starters(page)).toBeVisible();
    await expect(recent(page)).toBeVisible();
    await expect(usage(page)).toBeVisible();

    const top = async (region: ReturnType<typeof starters>) => (await region.boundingBox())!.y;
    expect(await top(starters(page)), 'the starters are below the recent templates').toBeLessThan(await top(recent(page)));
    expect(await top(recent(page)), 'the recent templates are below usage').toBeLessThan(await top(usage(page)));
  });

  test('gives an Enterprise workspace its usage as counts, with no bar to fill', async ({ page }) => {
    await page.goto('/dashboard');
    const section = usage(page);
    await expect(section.getByText('Live API calls this month')).toBeVisible();
    await expect(section.getByText('Templates', { exact: true })).toBeVisible();
    await expect(section.getByText('Storage', { exact: true })).toBeVisible();
    // Nothing caps calls, templates or storage, so there is no ceiling to draw a bar against.
    await expect(section.getByText('no limit')).toHaveCount(3);
    await expect(section.getByRole('progressbar')).toHaveCount(0);
    // Membership is still a count even when the plan has no usage ceiling.
    await expect(section.getByText('Members', { exact: true })).toBeVisible();
  });

  test('offers the starters, and one makes a template and opens it in the editor', async ({ page, api }) => {
    await openHome(page);
    await starters(page).getByRole('button', { name: 'Blank', exact: true }).click();
    await expect(page).toHaveURL(/\/templates\/[0-9a-f-]{36}$/);
    // Handed to the fixture at once: a failure below would otherwise leave
    // the row behind for the rest of the run.
    api.track(page.url().split('/').pop()!);
    await expect(page.locator('.ProseMirror')).toBeVisible();
  });

  test('names a template waiting for sign-off above everything else, and opens its review', async ({ page, api, name }) => {
    // Another spec may put a template into sign-off after this one's, and the
    // banner names one. Seeding again, under a name of its own, is how this
    // reads "mine is the one shown" without a position to rely on.
    let attempt = 0;
    let made!: { id: string; title: string };
    await expect(async () => {
      const title = name(`sign-off #${++attempt}`);
      made = await api.createTemplate({ title });
      await api.saveDraft(made.id, { title, content: doc('Candidate for sign-off') });
      expect((await page.request.post(`/api/v1/templates/${made.id}/stage`)).ok()).toBe(true);
      expect((await page.request.post(`/api/v1/templates/${made.id}/request-signoff`)).ok()).toBe(true);
      await page.goto('/dashboard');
      await expect(nextStep(page).getByText(`${title} is ready for your sign-off`)).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });

    const banner = nextStep(page);
    await expect(banner.getByText(/^Moved to sign-off/)).toBeVisible();
    const review = banner.getByRole('link', { name: 'Review', exact: true });
    await expect(review).toHaveAttribute('href', `/templates/${made.id}/review`);
    // It leads the page rather than sitting among the sections it summarises.
    const bannerBox = (await banner.boundingBox())!;
    expect(bannerBox.y + bannerBox.height, 'the banner is not above the starters').toBeLessThanOrEqual(
      (await starters(page).boundingBox())!.y,
    );

    await review.click();
    await expect(page).toHaveURL(new RegExp(`/templates/${made.id}/review$`));
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
      starters(page).getByRole('button', { name: 'Blank', exact: true }),
      recent(page).getByRole('link', { name: 'View all', exact: true }),
    ]) {
      await expect(control).toBeVisible();
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
