import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { test as setup, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { TEST_USER } from '../env';
import { fakes } from '../fakes/client';
import { WORKSPACES_FILE } from '../fixtures/workspaces';
import { ensureSecondUser } from './clerk';
import { upgradeTo } from './plan';
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

  // A fresh database puts the workspace on the Free plan: two templates,
  // one brand, one live key. Every spec seeds its own and the two browser
  // projects run at once, so the run takes the plan with no ceilings — the
  // checkout route only sells Pro, and the forged webhook names Enterprise.
  // The plan is read back so a silent failure of the upgrade fails the run
  // here rather than as a 402 inside some unrelated spec.
  const session = await upgradeTo(page.request, fakes, 'enterprise');
  const quota = await page.request.get('/api/v1/quota');
  expect(quota.ok(), 'the quota endpoint answers').toBeTruthy();
  expect((await quota.json()).plan, 'the workspace is on Enterprise').toBe('enterprise');

  // The second user's standing in Clerk, and the ids the specs that sign
  // them in need — the checkout above is where the shared org's id is seen,
  // and the signed-in user's own id with it, so the second user can be
  // proven to be someone else before their role is touched.
  writeFileSync(WORKSPACES_FILE, JSON.stringify(await ensureSecondUser(session.orgId, session.userId)));

  await page.context().storageState({ path: STORAGE_STATE });
});
