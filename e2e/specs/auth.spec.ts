import { STORAGE_STATE } from '../setup/storage-state';
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
    // Its own context: the shared storageState must survive for the other specs.
    const context = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await context.newPage();
    await page.goto('/dashboard');

    // Below `md` the sidebar — and the account trigger inside it — is
    // display:none, so it drops out of the accessibility tree; the drawer's
    // copy is what a phone visitor actually uses. Open it first when present
    // so this test passes on both the desktop and the phone project.
    const openNav = page.getByRole('button', { name: 'Open navigation' });
    if (await openNav.isVisible()) await openNav.click();

    // The app renders its own account control, not Clerk's UserButton, and
    // it carries no aria-label — its accessible name is whatever text sits
    // inside it (initials, name, email). The email is the one part of that
    // text guaranteed to render, name or no name on the Clerk profile.
    await page.getByRole('button').filter({ hasText: TEST_USER.email }).click();
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
