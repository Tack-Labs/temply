import type { BrowserContext, Page } from '@playwright/test';
import { TEST_USER_2 } from '../env';
import { test, expect } from '../fixtures/test';
import { makeApi } from '../fixtures/api';
import { renameTo, publish } from '../fixtures/editor';
import { refreshSession, signInAs } from '../fixtures/session';
import { readWorkspaces } from '../fixtures/workspaces';
import { recordedCheckout, completeCheckout, cancelSubscription, type CheckoutSession } from '../setup/plan';

// The second user's own workspace is the one Free workspace the run has;
// these tests move it Free → Pro → Free in order, so they run serially, on
// one project (phone-chromium ignores the file), with no retry: a retry
// would find the plan already moved.
test.describe.configure({ mode: 'serial', retries: 0 });

/** The plan card is a plain box with no role of its own, so the card that
 *  is current is read the way the customer reads it: the plan's name and the
 *  "Current plan" badge beside it make one line of text. */
const currentPlanRow = (page: Page, plan: 'Free' | 'Pro') => page.getByText(new RegExp(`^${plan}\\s*Current plan$`));

test.describe('billing', () => {
  let context: BrowserContext | undefined;
  let page: Page;
  let session: CheckoutSession;

  test.beforeEach(async ({ browser }) => {
    ({ context, page } = await signInAs(browser, TEST_USER_2, readWorkspaces().second));
  });
  test.afterEach(async () => {
    await context?.close();
  });

  test('the Free plan states its limits and holds them', async ({ name }) => {
    // The second user's own session: the `api` fixture would make and
    // delete rows as the first user, in the shared workspace. What is made
    // here is deleted here, even when an assertion fails part-way.
    const api = makeApi(page.request);
    try {
      await page.goto('/dashboard/settings/plan');
      await expect(currentPlanRow(page, 'Free')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Current plan' })).toBeDisabled();
      await expect(page.getByText('0 / 10,000')).toBeVisible();

      // Templates: two are the cap.
      const { id } = await api.createTemplate({ title: name('one') });
      await api.createTemplate({ title: name('two') });
      await page.goto('/dashboard/templates');
      await expect(page.getByText("You've used all 2 templates on the Free plan.")).toBeVisible();
      await expect(page.getByRole('button', { name: 'New template' }).first()).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Duplicate template' })).toHaveCount(0);
      const third = await page.request.post('/api/v1/templates', { data: { title: name('three'), content: '{"type":"doc","content":[]}' } });
      expect(third.status()).toBe(402);
      expect((await third.json()).message).toBe('Free plan is limited to 2 templates. Upgrade to create more.');

      // Brands: one.
      const brand = await page.request.post('/api/v1/brands', { data: { name: name('brand'), theme: '{}' } });
      expect(brand.ok()).toBe(true);
      api.trackBrand((await brand.json()).brand.id);
      await page.goto('/dashboard/brands');
      await expect(page.getByText("You've used all 1 custom brand on your plan.")).toBeVisible();
      await expect(page.getByRole('button', { name: 'New brand' }).first()).toBeDisabled();

      // Live keys: one; the dialog then offers Test only.
      const key = await page.request.post('/api/v1/api-keys', { data: { name: name('live'), mode: 'live' } });
      expect(key.ok()).toBe(true);
      api.trackApiKey((await key.json()).key.id);
      await page.goto('/dashboard/settings/api-keys');
      await expect(page.getByText("You've used all 1 API keys on your plan.")).toBeVisible();
      await page.getByRole('button', { name: 'Create key' }).first().click();
      // The radio is named by its label alone; the Pro marker and the terms
      // under it are its description, which is where they belong.
      const live = page.getByRole('dialog', { name: 'Create API key' }).getByRole('radio', { name: 'Live', exact: true });
      await expect(live).toBeDisabled();
      await expect(live).toHaveAccessibleDescription(/^Pro Renders what you published\./);
      await page.keyboard.press('Escape');

      // Versions: a publish on Free keeps none.
      await page.goto(`/templates/${id}`);
      // Typing into the subject before the editor is live is lost; the body
      // is drawn only once it has mounted, so its text is the sign to wait for.
      await expect(page.getByText('Hello from e2e')).toBeVisible();
      await renameTo(page, id, name('published on free'));
      await publish(page);
      await expect(page.getByText('Published', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'History' }).click();
      await expect(page.getByRole('dialog', { name: 'Version history' }).getByText('No versions yet. Each publish creates one.')).toBeVisible();
    } finally {
      await api.cleanup();
    }
  });

  test('upgrading through checkout puts the workspace on Pro', async ({ fakes }) => {
    await page.goto('/dashboard/settings/plan');
    // On Free the one Upgrade button is Pro's: Free is current and
    // Enterprise is arranged by mail.
    await page.getByRole('button', { name: 'Upgrade' }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/plan\?success=true/);
    await expect(page.getByText('Subscription updated')).toBeVisible();
    // Stripe's webhook is the only forged step; the checkout above was real.
    session = await recordedCheckout(fakes);
    await completeCheckout(page.request, fakes, session, 'pro');
    await page.goto('/dashboard/settings/plan');
    await expect(currentPlanRow(page, 'Pro')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage subscription' })).toBeVisible();
    await expect(page.getByText('0 / 50,000')).toBeVisible();
    await page.goto('/dashboard/templates');
    await expect(page.getByText("You've used all 2 templates on the Free plan.")).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New template' }).first()).toBeEnabled();
  });

  test('the billing portal opens from Manage subscription', async () => {
    await page.goto('/dashboard/settings/plan');
    // The click posts, then the portal's URL is followed as a full page
    // load. Both ride on the session cookie, and a page load resolves before
    // Clerk's first renewal of it (see refreshSession) — on a slow runner
    // the token saved by the sign-in was past its minute by the time the
    // load came round, and the load ended on the sign-in page instead.
    await refreshSession(page);
    await page.getByRole('button', { name: 'Manage subscription' }).click();
    await expect(page).toHaveURL(/portal=fake/);
  });

  test('a cancelled subscription returns the workspace to Free', async ({ fakes }) => {
    await cancelSubscription(page.request, fakes, session.customer);
    await page.goto('/dashboard/settings/plan');
    await expect(currentPlanRow(page, 'Free')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage subscription' })).toHaveCount(0);
  });
});
