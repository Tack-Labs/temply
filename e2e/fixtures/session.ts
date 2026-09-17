import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { test } from './test';
import { emulateCoarsePointer } from './phone';

type Credentials = { email: string; password: string };

type WindowWithClerk = Window & { Clerk?: { loaded?: boolean; setActive: (params: { organization: string }) => Promise<void> } };

/**
 * Clerk's client state — the caller's role in the workspace included —
 * arrives after the first paint, and until it does the dashboard draws the
 * member's view for everyone. A test that asserts what a member is not
 * shown waits for this first, or it passes for an admin too.
 */
export async function clerkLoaded(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as WindowWithClerk).Clerk?.loaded === true);
}

/**
 * A session of its own for a user other than the one in the shared
 * storageState: a fresh context, a real Clerk sign-in, and the workspace the
 * test names made active in that session. `browser.newContext` from the test
 * runner inherits the project's device and baseURL, so only storageState is
 * overridden. The caller closes the context; nothing here signs out, since
 * a sign-out revokes the session server-side and another test may be
 * holding one for the same user.
 */
export async function signInAs(browser: Browser, user: Credentials, orgId: string): Promise<{ context: BrowserContext; page: Page }> {
  await clerkSetup();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  if (test.info().project.name.startsWith('phone')) await emulateCoarsePointer(page);
  await page.goto('/login');
  await clerk.signIn({ page, signInParams: { strategy: 'password', identifier: user.email, password: user.password } });
  // Whichever workspace Clerk remembered for this user, the test names the
  // one it wants. /dashboard bounces to /onboarding when none is active,
  // and Clerk is loaded on either page.
  await page.goto('/dashboard');
  await clerkLoaded(page);
  await page.evaluate((organization) => (window as WindowWithClerk).Clerk!.setActive({ organization }), orgId);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 30_000 });
  return { context, page };
}
