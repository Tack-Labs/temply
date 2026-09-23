import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { emulateCoarsePointer } from './phone';
import { onPhone } from './project';

type Credentials = { email: string; password: string };

type WindowWithClerk = Window & {
  Clerk?: { loaded?: boolean; setActive: (params: { organization: string }) => Promise<void>; session?: { getToken: () => Promise<string | null> } };
};

/**
 * Clerk's client state — the caller's role in the workspace included —
 * arrives after the first paint, and until it does the dashboard draws the
 * member's view for everyone. A test that asserts what a member is not
 * shown waits for this first, which narrows the window in which the
 * assertion could pass for an admin to the one React render that follows;
 * it does not close it.
 */
export async function clerkLoaded(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as WindowWithClerk).Clerk?.loaded === true);
}

/**
 * Makes a workspace the active one in this session. Whichever workspace
 * Clerk remembered for the user, the caller names the one it wants:
 * /dashboard bounces to /onboarding when none is active, Clerk is loaded on
 * either page, and the dashboard's "Welcome back" is the sign the switch
 * took.
 */
export async function activateWorkspace(page: Page, orgId: string): Promise<void> {
  await page.goto('/dashboard');
  await clerkLoaded(page);
  await page.evaluate((organization) => (window as WindowWithClerk).Clerk!.setActive({ organization }), orgId);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 30_000 });
}

/**
 * Renews the context's session cookie now. Clerk's token lives about a
 * minute and the one saved by setup is older than that by the time a spec
 * runs; the client renews it on its own, but a page load resolves before
 * that first renewal, so a test that seeds through `page.request` straight
 * away is refused. Minting a token waits for the renewal, and from then on
 * the open page keeps the cookie fresh for as long as the test runs.
 */
export async function refreshSession(page: Page): Promise<void> {
  await clerkLoaded(page);
  await page.evaluate(() => (window as WindowWithClerk).Clerk?.session?.getToken());
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
  // A sign-in that fails part-way would otherwise leave the context open
  // for the rest of the worker's life; the caller never sees it to close it.
  try {
    const page = await context.newPage();
    if (onPhone()) await emulateCoarsePointer(page);
    await page.goto('/login');
    await clerk.signIn({ page, signInParams: { strategy: 'password', identifier: user.email, password: user.password } });
    await activateWorkspace(page, orgId);
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}
