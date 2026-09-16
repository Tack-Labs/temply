import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { test as setup, expect } from '@playwright/test';
import { TEST_USER } from '../env';
import { STORAGE_STATE } from './storage-state';

/**
 * One sign-in per run. `clerkSetup` fetches a testing token for the dev
 * instance so Clerk's bot protection lets an automated sign-in through;
 * `clerk.signIn` drives the password strategy without a form. The result
 * is saved as storageState and every spec starts from it.
 */
setup('sign in as the e2e user', async ({ page }) => {
  await clerkSetup();
  expect(TEST_USER.email, 'E2E_USER_EMAIL is set').toBeTruthy();
  await page.goto('/login');
  await clerk.signIn({ page, signInParams: { strategy: 'password', identifier: TEST_USER.email, password: TEST_USER.password } });
  await page.goto('/dashboard');
  // The dashboard's own h1 is "Welcome back[, name]" (DashboardPage via
  // PageHeader) — the sign the org-adopt above landed here rather than on
  // /onboarding or bouncing back to /login.
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: STORAGE_STATE });
});
