import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { test as setup, expect, type Browser, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { RUN_ID, TEST_USER } from '../env';
import { fakes } from '../fakes/client';
import { EMPTY_DOC } from '../fixtures/api';
import { WORKSPACES_FILE } from '../fixtures/workspaces';
import { activateWorkspace } from '../fixtures/session';
import { ensureFirstWorkspace, ensureSecondUser } from './clerk';
import { upgradeTo } from './plan';
import { STORAGE_STATE } from './storage-state';

/** What one attempt at the sign-in is allowed, well under the setup's own
 *  budget so a stall leaves room for the second attempt and the rest. */
const ATTEMPT_MS = 60_000;

/** The work, or an error naming it, whichever comes first. The work itself is
 *  not cancellable — Playwright has no handle on a call already inside Clerk's
 *  client — so what is abandoned here keeps running against a context the
 *  caller then stops using. */
function within<T>(work: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const capped = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish in ${ATTEMPT_MS / 1000} s`)), ATTEMPT_MS);
  });
  return Promise.race([work, capped]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * The sign-in, with one retry on a context of its own.
 *
 * Clerk's dev instance stalls now and then: sign-ins have hung for a quarter
 * of an hour against clean ports and gone through in thirty-six seconds on
 * the next try. The setup project is a dependency and not a test, so the
 * config's `retries` never reaches it — a stall would eat the whole CI job
 * and leave no assertion to read. The cap is what turns that into a fast
 * failure, and the second attempt starts on a fresh context because a
 * half-finished sign-in leaves cookies the next one would mistake for a
 * session.
 */
async function signIn(browser: Browser, first: Page): Promise<Page> {
  let last: unknown;
  for (const attempt of [1, 2]) {
    const page = attempt === 1 ? first : await (await browser.newContext()).newPage();
    try {
      await within((async () => {
        await page.goto('/login');
        await clerk.signIn({ page, signInParams: { strategy: 'password', identifier: TEST_USER.email, password: TEST_USER.password } });
      })(), `attempt ${attempt} of the Clerk sign-in`);
      return page;
    } catch (error) {
      last = error;
      console.warn(`[auth.setup] attempt ${attempt} of the Clerk sign-in failed: ${(error as Error).message}`);
    }
  }
  throw last;
}

/**
 * One sign-in per run. `clerkSetup` fetches a testing token for the dev
 * instance so Clerk's bot protection lets an automated sign-in through;
 * `clerk.signIn` drives the password strategy without a form. The result
 * is saved as storageState and every spec starts from it.
 */
setup('sign in as the e2e user', async ({ page: firstPage, browser }) => {
  // The sign-in, the checkout, the Clerk writes and a cold editor render
  // add up to more than the 30 s one spec gets, and the sign-in is allowed
  // two capped attempts inside that.
  setup.setTimeout(240_000);
  await clerkSetup();
  expect(TEST_USER.email, 'E2E_USER_EMAIL is set').toBeTruthy();
  const page = await signIn(browser, firstPage);
  // The run's shared workspace is the user's own, by name, not whichever
  // workspace Clerk last remembered for them; it is made active here so the
  // checkout below and every spec's storageState are scoped to it.
  const first = await ensureFirstWorkspace();
  await activateWorkspace(page, first.orgId);

  // A fresh database puts the workspace on the Free plan: two templates,
  // one brand, one live key. Every spec seeds its own and the two browser
  // projects run at once, so the run takes the plan with no ceilings — the
  // checkout route only sells Pro, and the forged webhook names Enterprise.
  // The plan is read back so a silent failure of the upgrade fails the run
  // here rather than as a 402 inside some unrelated spec.
  const session = await upgradeTo(page.request, fakes, 'enterprise');
  expect(session.orgId, 'the checkout was scoped to the first workspace').toBe(first.orgId);
  const quota = await page.request.get('/api/v1/quota');
  expect(quota.ok(), 'the quota endpoint answers').toBeTruthy();
  expect((await quota.json()).plan, 'the workspace is on Enterprise').toBe('enterprise');

  // The second user's standing in Clerk, and the ids the specs that sign
  // them in need; the first user's own id goes along so the second user can
  // be proven to be someone else before their role is touched.
  // A fresh checkout (CI) has no .auth directory yet; Playwright makes it
  // for the storageState below, but this file is written first.
  mkdirSync(dirname(WORKSPACES_FILE), { recursive: true });
  writeFileSync(WORKSPACES_FILE, JSON.stringify(await ensureSecondUser(first.orgId, first.userId)));

  // The first editor render on a cold `next start` pays a JIT cost that a
  // spec's 30 s budget should not, and CI's `retries: 1` would otherwise
  // hide it as a pass-on-retry. One template is opened here and deleted, so
  // no spec's first test is the one that warms the route.
  const warm = await page.request.post('/api/v1/templates', { data: { title: `e2e ${RUN_ID} · setup · warm the editor`, content: EMPTY_DOC } });
  expect(warm.ok(), 'the warm-up template is made').toBeTruthy();
  const warmId = (await warm.json()).template.id as string;
  await page.goto(`/templates/${warmId}`);
  await expect(page.locator('.ProseMirror').getByText('Hello from e2e')).toBeVisible({ timeout: 60_000 });
  expect((await page.request.delete(`/api/v1/templates/${warmId}`)).ok(), 'the warm-up template is deleted').toBeTruthy();

  await page.context().storageState({ path: STORAGE_STATE });
});
