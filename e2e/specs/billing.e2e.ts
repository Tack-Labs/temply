import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import { STRIPE, STRIPE_URL, TEST_USER_2 } from '../env';
import { test, expect } from '../fixtures/test';
import { makeApi } from '../fixtures/api';
import { refreshSession, signInAs } from '../fixtures/session';
import { readWorkspaces } from '../fixtures/workspaces';
import { recordedCheckout, completeCheckout, cancelSubscription, endSubscription } from '../setup/plan';

// The second user's own workspace is the one trial the run has; these tests
// move it trial → Team → cancelled → lapsed in order, so they run serially,
// on one project (phone-chromium ignores the file), with no retry: a retry
// would find the plan already moved. Each run has a fresh database, so the
// next run starts on a trial again.
test.describe.configure({ mode: 'serial', retries: 0 });

const PLAN_PAGE = '/dashboard/settings/plan';
/** Seats follow the workspace's members, which Clerk holds across runs, so
 *  the price is read as a shape rather than a sum. */
const SUBSCRIBE = /^Subscribe · \$\d+\/month$/;
const portalUrl = new RegExp(`^${STRIPE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/portal/`);

/** The plan's name is the summary card's heading; its state is the badge beside it. */
const planHeading = (page: Page, label: string) => page.getByRole('heading', { name: label, exact: true });

const render = (request: APIRequestContext, shortCode: string, key: string) =>
  request.post(`/api/public/v1/templates/${shortCode}/render`, { headers: { Authorization: `Bearer ${key}` }, data: {} });

test.describe('billing', () => {
  let context: BrowserContext | undefined;
  let page: Page;
  let subscriptionId: string;

  test.beforeEach(async ({ browser }) => {
    ({ context, page } = await signInAs(browser, TEST_USER_2, readWorkspaces().second));
  });
  test.afterEach(async () => {
    await context?.close();
  });

  test('a trial states its limits and holds them', async ({ name }) => {
    // The second user's own session: the `api` fixture would make and
    // delete rows as the first user, in the shared workspace. What is made
    // here is deleted here, even when an assertion fails part-way.
    const api = makeApi(page.request);
    try {
      await page.goto(PLAN_PAGE);
      await expect(planHeading(page, 'Free trial')).toBeVisible();
      await expect(page.getByText('14 days left', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Subscribe to Team' })).toBeVisible();
      await expect(page.getByRole('button', { name: SUBSCRIBE })).toBeEnabled();
      await expect(page.getByRole('progressbar', { name: 'Live API calls this month' })).toHaveAttribute('aria-valuetext', '0 of 10,000');
      await expect(page.getByText('10 per template', { exact: true })).toBeVisible();
      // Every call counts, so the plan page says how to make fewer.
      await expect(page.getByText('Cache renders to make fewer calls')).toBeVisible();
      await expect(page.getByRole('link', { name: 'How to cache renders' })).toHaveAttribute('href', '/docs#caching');

      // Templates: ten are the cap.
      const billing = await (await page.request.get('/api/v1/billing')).json();
      for (let i = billing.usage.templates; i < 10; i++) await api.createTemplate({ title: name(`template ${i + 1}`) });
      await page.goto('/dashboard/templates');
      await expect(page.getByText("You've used all 10 templates in your trial.")).toBeVisible();
      await expect(page.getByText('Subscribe, then add a template pack for 10 more — $5 a month each.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'New template' }).first()).toBeDisabled();
      const eleventh = await page.request.post('/api/v1/templates', { data: { title: name('eleventh'), content: '{"type":"doc","content":[]}' } });
      expect(eleventh.status()).toBe(402);
      expect((await eleventh.json()).message).toBe("You've used all 10 templates in the trial. Subscribe, then add a template pack for 10 more.");
    } finally {
      await api.cleanup();
    }
  });

  test('subscribing through checkout puts the workspace on Team', async ({ fakes }) => {
    await page.goto(PLAN_PAGE);
    await page.getByRole('button', { name: SUBSCRIBE }).click();
    // The fake checkout sends the browser straight back, as a paid one
    // would, and the page waits for Stripe's word before it changes.
    await expect(page).toHaveURL(/\/dashboard\/settings\/plan\?success=true/);
    await expect(page.getByText('Confirming your subscription with Stripe…')).toBeVisible();

    const session = await recordedCheckout(fakes);
    expect(session.orgId, 'the checkout was scoped to the second workspace').toBe(readWorkspaces().second);
    expect(session.seats).toBeGreaterThanOrEqual(1);
    expect(session.templatePacks).toBe(0);
    // The webhook is the only forged step; the checkout above was real.
    subscriptionId = await completeCheckout(page.request, fakes, { orgId: session.orgId });

    await expect(page.getByText('You’re on Team')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PLAN_PAGE}$`));
    await expect(planHeading(page, 'Team')).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage billing' })).toBeVisible();
    await expect(page.getByRole('button', { name: SUBSCRIBE })).toHaveCount(0);
    await expect(page.getByRole('progressbar', { name: 'Live API calls this month' })).toHaveAttribute('aria-valuetext', '0 of 10,000 included');

    // A second subscription would bill the workspace twice.
    const again = await page.request.post('/api/v1/billing/checkout', { data: {} });
    expect(again.status()).toBe(409);
    expect((await again.json()).message).toBe('This workspace already has a plan. Change it from Manage billing.');
  });

  test('a template pack adds ten templates and keeps fifty versions', async ({ fakes }) => {
    await page.goto(PLAN_PAGE);
    const packs = page.getByRole('group', { name: 'Template packs' });
    await packs.getByRole('button', { name: 'Add a pack' }).click();
    await expect(page.getByText(/^20 templates · \$\d+ → \$\d+ a month, prorated from today\.$/)).toBeVisible();
    await page.getByRole('button', { name: 'Update packs' }).click();
    await expect(page.getByText('1 template pack on your plan')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Templates' })).toHaveAttribute('aria-valuemax', '20');
    await expect(page.getByText('50 per template', { exact: true })).toBeVisible();
    const added = (await fakes.requests('stripe')).filter((r) => r.method === 'POST' && r.path === '/v1/subscription_items');
    expect(added.map((r) => r.body)).toContainEqual(expect.objectContaining({ subscription: subscriptionId, price: STRIPE.prices.templatePack, quantity: '1' }));

    // Taking the last pack away shrinks what every template keeps, so it asks first.
    await packs.getByRole('button', { name: 'Remove a pack' }).click();
    await page.getByRole('button', { name: 'Update packs' }).click();
    await page.getByRole('dialog', { name: 'Remove all template packs?' }).getByRole('button', { name: 'Remove packs' }).click();
    await expect(page.getByText('Template packs removed')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Templates' })).toHaveAttribute('aria-valuemax', '10');
    await expect(page.getByText('10 per template', { exact: true })).toBeVisible();
    const removed = (await fakes.requests('stripe')).filter((r) => r.method === 'DELETE' && r.path.startsWith('/v1/subscription_items/'));
    expect(removed).toHaveLength(1);
  });

  test('the billing portal opens from Manage billing', async () => {
    await page.goto(PLAN_PAGE);
    // The click posts, then the portal's URL is followed as a full page
    // load. Both ride on the session cookie, and a page load resolves before
    // Clerk's first renewal of it (see refreshSession) — on a slow runner
    // the token saved by the sign-in was past its minute by the time the
    // load came round, and the load ended on the sign-in page instead.
    await refreshSession(page);
    await page.getByRole('button', { name: 'Manage billing' }).click();
    await expect(page).toHaveURL(portalUrl);
    await expect(page.getByRole('heading', { name: 'Billing portal' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to Temply' })).toHaveAttribute('href', new RegExp(`${PLAN_PAGE}$`));
  });

  test('a cancelled plan runs to its end date and offers the way back', async ({ fakes }) => {
    await cancelSubscription(page.request, fakes, subscriptionId);
    await page.goto(PLAN_PAGE);
    // Still Team until the period paid for runs out; the badge says when,
    // where "Active" stood.
    await expect(planHeading(page, 'Team')).toBeVisible();
    await expect(page.getByText(/^Ends .+$/)).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^The plan ends on .+, and the workspace turns read-only\./)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage billing' })).toHaveCount(0);
    // The cancellation is undone in the portal. The session is renewed
    // first for the reason the portal test gives.
    await refreshSession(page);
    await page.getByRole('button', { name: 'Resume plan' }).click();
    await expect(page).toHaveURL(portalUrl);
  });

  test('an ended plan leaves the workspace read-only, with everything kept', async ({ fakes, name }) => {
    const api = makeApi(page.request);
    try {
      // Made while the plan still runs, to prove what it leaves behind.
      const { id, title } = await api.createTemplate({ title: name('kept') });
      await api.publishTemplate(id);
      const { short_code } = await api.getTemplate(id);
      const keyRes = await page.request.post('/api/v1/api-keys', { data: { name: name('live'), mode: 'live' } });
      expect(keyRes.ok()).toBe(true);
      const { key } = await keyRes.json();
      api.trackApiKey(key.id);
      expect((await render(page.request, short_code, key.full_key)).status()).toBe(200);

      await endSubscription(page.request, fakes, subscriptionId);

      await page.goto(PLAN_PAGE);
      await expect(planHeading(page, 'Read-only')).toBeVisible();
      await expect(page.getByText('Editing paused', { exact: true })).toBeVisible();
      await expect(page.getByText('Subscribing makes the workspace editable again straight away, with everything as you left it.')).toBeVisible();
      await expect(page.getByRole('button', { name: SUBSCRIBE })).toBeEnabled();

      // The list still opens and says why nothing can be made.
      await page.goto('/dashboard/templates');
      await expect(page.getByRole('status').filter({ hasText: 'This workspace is read-only' })).toBeVisible();
      await expect(page.getByText(title)).toBeVisible();
      await expect(page.getByRole('button', { name: 'New template' }).first()).toBeDisabled();
      const refused = await page.request.post('/api/v1/templates', { data: { title: name('refused'), content: '{"type":"doc","content":[]}' } });
      expect(refused.status()).toBe(402);
      expect((await refused.json()).message).toBe('This workspace is read-only until it has a plan. Subscribe on the Plan page to make changes again.');

      // The editor opens the template to read, not to change.
      await page.goto(`/templates/${id}`);
      await expect(page.getByText('Hello from e2e')).toBeVisible();
      await expect(page.getByText('This workspace is read-only')).toBeVisible();
      await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
      await expect(page.getByRole('textbox', { name: 'Subject' })).not.toBeEditable();
      await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();

      // Live keys stop with the plan.
      const paused = await render(page.request, short_code, key.full_key);
      expect(paused.status()).toBe(402);
      expect((await paused.json()).message).toBe("This workspace's trial or plan has ended, so its live keys are paused. Subscribe on the Plan page to resume them.");
    } finally {
      // Deleting is allowed while read-only, so the cleanup is part of the proof.
      await api.cleanup();
    }
  });
});
