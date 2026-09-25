import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { TEST_USER, TEST_USER_2 } from '../env';
import { onPhone } from '../fixtures/project';
import { signInAs } from '../fixtures/session';
import { test, expect } from '../fixtures/test';
import { readWorkspaces } from '../fixtures/workspaces';

test.describe('auth', () => {
  test('a signed-out visitor is sent to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('the front page knows who is signed in without loading Clerk for who is not', async ({ page, browser }) => {
    // The marketing header reads sign-in state off Clerk's own hint cookie,
    // so a visitor who is not signed in never fetches Clerk to be shown a
    // Sign in button — and one who is still gets the door to the dashboard
    // and the account menu, which brings Clerk with it on demand.
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    if (!onPhone()) {
      await page.getByRole('button', { name: 'Account', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();
      await page.keyboard.press('Escape');
    }

    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const stranger = await context.newPage();
    const scripts: string[] = [];
    stranger.on('request', (req) => { if (req.resourceType() === 'script') scripts.push(req.url()); });
    await stranger.goto('/');
    await expect(stranger.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(stranger.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    expect(scripts.some((url) => /clerk/i.test(url)), 'no Clerk script was fetched for a stranger').toBe(false);
    await context.close();
  });

  test('the signed-in user lands on the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // DashboardPage's h1 is "Welcome back[, name]" — the one heading that
    // route actually renders (see auth.setup.ts for why "Templates" is not it).
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('signing out ends the session', async ({ browser }) => {
    // A real sign-out revokes the session server-side, not just this
    // page's copy of it — reusing the shared storageState here would revoke
    // the token every other test's context is built from. Sign in a session
    // of its own instead, so the shared one survives the run.
    await clerkSetup(); // Idempotent (per @clerk/testing's docs); this test runs in its own worker, which hasn't called it yet.
    // The project's default storageState is the shared signed-in session —
    // override it with an empty one, or clerk.signIn below fails with
    // "You're already signed in."
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/login');
    await clerk.signIn({ page, signInParams: { strategy: 'password', identifier: TEST_USER.email, password: TEST_USER.password } });
    await page.goto('/dashboard');

    // Below `md` the sidebar — and the account trigger inside it — is
    // display:none, so it drops out of the accessibility tree; the drawer's
    // copy is what a phone visitor actually uses. Open it first on the
    // phone project so this test passes on both.
    if (onPhone()) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: /^Account/ }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    // signOut({ redirectUrl: '/' }) clears the session and then navigates
    // there itself; racing that with an immediate goto('/dashboard') can
    // land before the session is actually gone, so wait for it to land first.
    await expect(page).toHaveURL('/');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('the second user reaches both workspaces', async ({ browser }) => {
    const workspaces = readWorkspaces();
    const shared = await signInAs(browser, TEST_USER_2, workspaces.shared);
    expect((await (await shared.page.request.get('/api/v1/quota')).json()).plan).toBe('enterprise');
    await shared.context.close();
    // A new workspace starts on a trial, and the billing spec moves this one
    // on to Team and then to lapsed while the suite runs; Enterprise belongs
    // to the shared workspace alone, so any of the other three is what tells
    // this one apart.
    const own = await signInAs(browser, TEST_USER_2, workspaces.second);
    expect(['trial', 'team', 'lapsed']).toContain((await (await own.page.request.get('/api/v1/quota')).json()).plan);
    await own.context.close();
  });
});
