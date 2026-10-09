import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { onPhone, subjectField, openMore, publish } from '../fixtures/editor';

/**
 * Opens the template and waits until the editor is live: a click or a fill
 * on the desktop page before React has mounted is lost, and the canvas is
 * drawn only once the editor has.
 */
async function open(page: Page, id: string) {
  await page.goto(`/templates/${id}`);
  await expect(page.locator('.ProseMirror').getByText('Hello from e2e')).toBeVisible();
}

test.describe('publish and share', () => {
  test('publishing clears the draft badge', async ({ page, api, name }) => {
    // A template made through the API is already published, so it reads
    // "Published" with a time rather than "Unpublished changes" until the
    // subject edit below.
    const { id } = await api.createTemplate({ title: name('publish') });
    const edited = name('publish edited');
    await open(page, id);
    await (await subjectField(page)).fill(edited);
    if (onPhone()) await page.getByRole('dialog', { name: 'Email details' }).getByRole('button', { name: 'Close' }).click();
    await openMore(page);
    await expect(page.getByText('Unpublished changes')).toBeVisible();
    // `publish` opens the phone menu itself; a second tap on ⋯ would close it.
    if (onPhone()) await page.keyboard.press('Escape');
    await publish(page);
    // The toolbar's own label carries a date, so the bare word is the toast.
    await expect(page.getByText('Published', { exact: true })).toBeVisible();
    await openMore(page);
    await expect(page.getByText('Unpublished changes')).toHaveCount(0);
    await page.goto('/dashboard/templates');
    await page.getByRole('searchbox', { name: 'Search templates' }).fill(edited);
    const tile = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: edited }) });
    await expect(tile.getByText(/^Published/)).toBeVisible();
    await expect(tile.getByText('Draft', { exact: true })).toHaveCount(0);
  });

  test('the status reads Published with a time, then Unpublished changes, then Published again', async ({ page, api, name }) => {
    const { id } = await api.createTemplate({ title: name('status') });
    await open(page, id);
    // The bare word is the toast's, so the badge carries when as well. Both
    // shells hold the badge — the toolbar on desktop, the ⋯ menu's header on
    // the phone — so the menu is opened where there is one.
    const synced = page.getByText(/^Published \S/);
    await openMore(page);
    await expect(synced).toBeVisible();
    await expect(page.getByText('Unpublished changes')).toHaveCount(0);
    // Nothing to publish while the draft matches the live copy.
    if (onPhone()) await expect(page.getByRole('menuitem', { name: 'Publish', exact: true })).toHaveAttribute('aria-disabled', 'true');
    else await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    if (onPhone()) await page.keyboard.press('Escape');

    await (await subjectField(page)).fill(name('status edited'));
    if (onPhone()) await page.getByRole('dialog', { name: 'Email details' }).getByRole('button', { name: 'Close' }).click();
    await openMore(page);
    await expect(page.getByText('Unpublished changes')).toBeVisible();
    await expect(synced).toHaveCount(0);
    if (onPhone()) await page.keyboard.press('Escape');
    else await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();

    await publish(page);
    await expect(page.getByText('Published', { exact: true })).toBeVisible();
    await openMore(page);
    await expect(synced).toBeVisible();
    await expect(page.getByText('Unpublished changes')).toHaveCount(0);
  });

  test('a review link shows the draft to a visitor until it is turned off', async ({ page, api, name, browser }) => {
    const title = name('shared');
    const { id } = await api.createTemplate({ title });
    await open(page, id);
    // The phone is driven by touch, as a customer drives it.
    const press = (target: Locator) => (onPhone() ? target.tap() : target.click());
    // The dialog is told apart by its title. On both shells it opens from an
    // item of the ⋯ menu ("More" on the phone, "More actions" on the desktop)
    // and the menu stays open under it, so it is opened only when it is not
    // already up: a second press on ⋯ would close the menu instead.
    const share = page.getByRole('dialog').filter({ hasText: 'Review link' });
    const openShare = async () => {
      if (await share.isVisible()) return share;
      await press(page.getByRole('button', { name: onPhone() ? 'More' : 'More actions', exact: true }));
      await press(page.getByRole('menuitem', { name: 'Share link' }));
      return share;
    };
    let popover = await openShare();
    await press(popover.getByRole('button', { name: 'Create link' }));
    const url = await popover.getByRole('textbox', { name: 'Review link' }).inputValue();
    expect(url).toMatch(/\/p\/[A-Za-z0-9_-]+$/);

    // A visitor holds the link and nothing else: no session, no cookies.
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const guest = await visitor.newPage();
      await guest.goto(url);
      await expect(guest.getByText(title)).toBeVisible();
      await expect(guest.getByText('Preview', { exact: true })).toBeVisible();
      await expect(guest.getByTitle(/^Preview of /).contentFrame().getByText('Hello from e2e')).toBeVisible();

      popover = await openShare();
      await press(popover.getByRole('button', { name: 'Turn off link' }));
      await press(page.getByRole('dialog', { name: 'Turn off the link?' }).getByRole('button', { name: 'Turn off' }));
      await expect(page.getByText('Link turned off')).toBeVisible();

      const gone = await guest.goto(url);
      expect(gone?.status()).toBe(404);
      await expect(guest.getByRole('heading', { name: 'This link is not active' })).toBeVisible();
    } finally {
      await visitor.close();
    }
  });
});
