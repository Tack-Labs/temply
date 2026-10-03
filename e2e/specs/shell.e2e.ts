import { onPhone } from '../fixtures/project';
import { test, expect } from '../fixtures/test';
import type { Locator, Page } from '@playwright/test';

// The dashboard shell, read where a signed-in customer meets it: the sidebar
// on desktop and the same sidebar inside the drawer on a phone. Nothing here
// moves workspace state. The quota widget is read from answers given to
// /api/v1/quota in the page, because the shared workspace is Enterprise (a
// count and no bar) and the plan a second workspace sits on changes as the
// billing spec runs.

const DAY = 86_400_000;

/** The sidebar as a reader meets it: the drawer's copy on a phone, whose fixed one is display:none. */
async function openSidebar(page: Page): Promise<Locator> {
  if (onPhone()) await page.getByRole('button', { name: 'Open navigation' }).click();
  const sidebar = page.getByRole('complementary', { name: 'Workspace' });
  await expect(sidebar).toBeVisible();
  return sidebar;
}

type Overrides = { plan?: string; trialEndsAt?: string; api?: Record<string, number | null>; overage?: { calls: number; usd: number } };

/** What /api/v1/quota says, for a workspace on `plan` with the given usage. */
function quota({ plan = 'team', api = {}, ...rest }: Overrides = {}) {
  return {
    plan,
    cancelAt: null,
    trialEndsAt: null,
    api: { used: 1_200, limit: null, included: 10_000, remaining: null, ...api },
    overage: { calls: 0, usd: 0 },
    resetsOn: '2026-11-01',
    ...rest,
  };
}

async function openWithQuota(page: Page, answer: ReturnType<typeof quota>): Promise<Locator> {
  await page.route('**/api/v1/quota', (route) => route.fulfill({ json: answer }));
  await page.goto('/dashboard/templates');
  return openSidebar(page);
}

test.describe('the sidebar', () => {
  test('lists the sections, marks the one the page is in, and sends the rest off in a new tab', async ({ page }) => {
    await page.goto('/dashboard/templates');
    const nav = (await openSidebar(page)).getByRole('navigation', { name: 'Dashboard' });

    for (const [label, href] of [
      ['Overview', '/dashboard'],
      ['Templates', '/dashboard/templates'],
      ['Brands', '/dashboard/brands'],
      ['Assets', '/dashboard/assets'],
    ] as const) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
    }
    await expect(nav.getByRole('link', { name: 'Templates', exact: true })).toHaveAttribute('aria-current', 'page');
    for (const label of ['Overview', 'Brands', 'Assets', 'Landing', 'Documentation']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).not.toHaveAttribute('aria-current', 'page');
    }

    // Leaving the dashboard must not cost an editor tab its unsaved work.
    for (const label of ['Landing', 'Documentation']) {
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('target', '_blank');
    }
  });

  test('moves the current mark with the page, and Overview is current only on its own', async ({ page }) => {
    await page.goto('/dashboard');
    let nav = (await openSidebar(page)).getByRole('navigation', { name: 'Dashboard' });
    await expect(nav.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Templates', exact: true })).not.toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: 'Brands', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/brands$/);
    // A phone's drawer closes on navigation, so the next read opens it again.
    nav = (await openSidebar(page)).getByRole('navigation', { name: 'Dashboard' });
    await expect(nav.getByRole('link', { name: 'Brands', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: 'Overview', exact: true })).not.toHaveAttribute('aria-current', 'page');
  });

  test('keeps the account menu in reach, named as the auth spec finds it', async ({ page }) => {
    await page.goto('/dashboard/templates');
    const sidebar = await openSidebar(page);
    await sidebar.getByRole('button', { name: /^Account/ }).click();
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toHaveCount(0);
  });
});

test.describe('the mobile drawer', () => {
  test.beforeEach(() => {
    test.skip(!onPhone(), 'the desktop sidebar is fixed in place and has no drawer to open');
  });

  test('is out of the page until it is opened', async ({ page }) => {
    await page.goto('/dashboard/templates');
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('puts the page behind it out of reach while it is open', async ({ page }) => {
    await page.goto('/dashboard/templates');
    await expect(page.getByRole('main')).toHaveCount(1);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    // Radix marks everything outside the dialog aria-hidden, so a screen
    // reader cannot wander into the page the drawer is covering.
    await expect(page.getByRole('main')).toHaveCount(0);
  });

  for (const way of ['Escape', 'the close button', 'the scrim'] as const) {
    test(`closes on ${way} and hands focus back to the button that opened it`, async ({ page }) => {
      await page.goto('/dashboard/templates');
      const opener = page.getByRole('button', { name: 'Open navigation' });
      const drawer = page.getByRole('dialog', { name: 'Navigation' });

      await opener.click();
      await expect(drawer).toBeVisible();
      if (way === 'Escape') await page.keyboard.press('Escape');
      else if (way === 'the close button') await drawer.getByRole('button', { name: 'Close navigation' }).click();
      // The drawer is 16rem wide; the scrim is whatever of the phone's width is left of it.
      else await page.mouse.click((page.viewportSize()?.width ?? 390) - 20, 400);

      await expect(drawer).toHaveCount(0);
      await expect(opener).toBeFocused();
    });
  }

  test('closes when a link is followed, so it does not cover the page it opened', async ({ page }) => {
    await page.goto('/dashboard/templates');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'Assets', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/assets$/);
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
  });

  test('closes when the phone is turned to where the rail takes over, leaving the page usable', async ({ page }) => {
    await page.goto('/dashboard/templates');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();

    // Radix would stay modal under a scrim and panel that are display:none
    // from md, leaving a page that is inert and shows nothing to dismiss.
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('complementary', { name: 'Workspace' })).toBeVisible();
  });

  test('gives a 44px target a 56px bar, so its focus ring is not cut off at the edge', async ({ page }) => {
    await page.goto('/dashboard/templates');
    const opener = page.getByRole('button', { name: 'Open navigation' });
    const bar = page.getByRole('banner');
    expect((await bar.boundingBox())?.height).toBeCloseTo(56, 0);
    // The global ring is 2px wide and 2px off the control: 4px to clear.
    expect((await opener.boundingBox())?.y).toBeGreaterThanOrEqual(4);

    await opener.click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();
    expect((await drawer.getByRole('link', { name: 'Temply' }).boundingBox())?.y).toBeGreaterThanOrEqual(4);
    expect((await drawer.getByRole('button', { name: 'Close navigation' }).boundingBox())?.y).toBeGreaterThanOrEqual(4);
    expect((await drawer.locator('aside > div').first().boundingBox())?.height).toBeCloseTo(56, 0);
  });

  test('is 44px to the touch: the opener, the close button, the links and the account button', async ({ page }) => {
    await page.goto('/dashboard/templates');
    const opener = page.getByRole('button', { name: 'Open navigation' });
    const openerBox = await opener.boundingBox();
    expect(openerBox?.height, 'the opener height').toBeGreaterThanOrEqual(44);
    expect(openerBox?.width, 'the opener width').toBeGreaterThanOrEqual(44);
    const targets: [string, Locator][] = [];
    await opener.click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();
    targets.push(
      ['the close button', drawer.getByRole('button', { name: 'Close navigation' })],
      ['a nav link', drawer.getByRole('link', { name: 'Templates', exact: true })],
      ['the account button', drawer.getByRole('button', { name: /^Account/ })],
    );
    for (const [what, target] of targets) {
      const box = await target.boundingBox();
      expect(box?.height, `${what} height`).toBeGreaterThanOrEqual(44);
      // The links and the account button run the width of the drawer; the
      // two icon buttons are square.
      expect(box?.width, `${what} width`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('the quota widget', () => {
  test('reads as a count with no bar on a plan with nothing to measure against', async ({ page }) => {
    // The shared workspace is Enterprise, which has no included amount.
    await page.goto('/dashboard/templates');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByText(/\d calls$/)).toBeVisible();
    await expect(sidebar.getByRole('progressbar')).toHaveCount(0);
  });

  test('shows how far along it is, in accent while there is room', async ({ page }) => {
    const sidebar = await openWithQuota(page, quota({ api: { used: 4_200 } }));
    const bar = sidebar.getByRole('progressbar', { name: /monthly API calls used$/ });
    await expect(bar).toHaveAttribute('aria-valuenow', '42');
    await expect(sidebar.getByText('42% used')).toBeVisible();
    // Team is already paying: nothing to subscribe to.
    await expect(sidebar.getByRole('link', { name: 'Subscribe' })).toHaveCount(0);
  });

  test('says so in the words under the bar when it is near the limit', async ({ page }) => {
    const sidebar = await openWithQuota(page, quota({ api: { used: 8_500 } }));
    await expect(sidebar.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85');
    await expect(sidebar.getByText('85% used')).toBeVisible();
  });

  test('counts what is over, and what it costs, once a paid plan carries on past what it includes', async ({ page }) => {
    const sidebar = await openWithQuota(page, quota({ api: { used: 11_200 }, overage: { calls: 1_200, usd: 1.2 } }));
    await expect(sidebar.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    await expect(sidebar.getByText(/^1,200 over/)).toBeVisible();
  });

  test('names the days left on a trial, and offers an admin the way to subscribe', async ({ page }) => {
    const sidebar = await openWithQuota(
      page,
      quota({
        plan: 'trial',
        trialEndsAt: new Date(Date.now() + 8.5 * DAY).toISOString(),
        api: { used: 4_200, limit: 10_000, remaining: 5_800 },
      }),
    );
    await expect(sidebar.getByText('Free trial')).toBeVisible();
    await expect(sidebar.getByText('9 days left')).toBeVisible();
    // The role arrives from Clerk after the first paint, so the button
    // appears once it has.
    await expect(sidebar.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', '/dashboard/settings/plan');
  });

  test('has no bar once the workspace has lapsed, and says why live keys stopped', async ({ page }) => {
    const sidebar = await openWithQuota(
      page,
      quota({ plan: 'lapsed', api: { used: 3_000, limit: 10_000, remaining: 7_000 } }),
    );
    await expect(sidebar.getByText('Live keys paused')).toBeVisible();
    await expect(sidebar.getByRole('progressbar')).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Subscribe' })).toBeVisible();
  });

  test('holds the card\'s place while the numbers load, then swaps in the card', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/v1/quota', async (route) => {
      await gate;
      await route.fulfill({ json: quota({ api: { used: 4_200 } }) });
    });
    await page.goto('/dashboard/templates');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByRole('status').filter({ hasText: 'Loading usage' })).toHaveCount(1);
    await expect(sidebar.getByRole('progressbar')).toHaveCount(0);

    release();
    await expect(sidebar.getByText('42% used')).toBeVisible();
    await expect(sidebar.getByRole('status').filter({ hasText: 'Usage loaded' })).toHaveCount(1);
  });

  test('never reads 100% before the limit is reached', async ({ page }) => {
    const sidebar = await openWithQuota(page, quota({ api: { used: 9_999 } }));
    await expect(sidebar.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '99');
    await expect(sidebar.getByText('99% used')).toBeVisible();
  });

  test('says the usage is unavailable, quietly, when the quota cannot be read', async ({ page }) => {
    await page.route('**/api/v1/quota', (route) => route.fulfill({ status: 500, json: { error: 'down' } }));
    await page.goto('/dashboard/templates');
    const sidebar = await openSidebar(page);
    await expect(sidebar.getByRole('navigation', { name: 'Dashboard' })).toBeVisible();
    await expect(sidebar.getByText('Usage unavailable')).toBeVisible();
    await expect(sidebar.getByRole('progressbar')).toHaveCount(0);
    await expect(sidebar.getByText(/used$|calls$|Live keys paused/)).toHaveCount(0);
  });
});
