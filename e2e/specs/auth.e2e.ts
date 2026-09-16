import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { TEST_USER } from '../env';
import { test, expect } from '../fixtures/test';

test.describe('auth', () => {
  test('a signed-out visitor is sent to login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
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
    if (test.info().project.name.startsWith('phone')) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    // signOut({ redirectUrl: '/' }) clears the session and then navigates
    // there itself; racing that with an immediate goto('/dashboard') can
    // land before the session is actually gone, so wait for it to land first.
    await expect(page).toHaveURL('/');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });
});
