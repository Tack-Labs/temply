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
    // A template made through the API is already published, so the badge
    // is absent until the subject edit below.
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

  test('a review link shows the draft to a visitor until it is turned off', async ({ page, api, name, browser }) => {
    const title = name('shared');
    const { id } = await api.createTemplate({ title });
    await open(page, id);
    // The phone is driven by touch here, not by the emulated mouse: the ⋯
    // menu hands focus to its own content when a mouse pointer leaves an
    // item, and the popover anchored to that item reads the move as focus
    // outside itself and closes. A finger never hovers, so a tap keeps the
    // popover up the way it stays up for a customer.
    const press = (target: Locator) => (onPhone() ? target.tap() : target.click());
    // The popover carries no name of its own; its heading is what tells it
    // apart. On the phone it anchors to a menu item and the menu stays open
    // under it, so it is opened only when it is not already up: a second tap
    // on ⋯ would close the menu instead.
    const share = page.getByRole('dialog').filter({ hasText: 'Review link' });
    const openShare = async () => {
      if (await share.isVisible()) return share;
      if (onPhone()) {
        await openMore(page);
        await press(page.getByRole('menuitem', { name: 'Share link' }));
      } else {
        await page.getByRole('button', { name: 'Share a review link' }).click();
      }
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
