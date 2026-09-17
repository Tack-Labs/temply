import { TEST_USER_2 } from '../env';
import { test, expect } from '../fixtures/test';
import { makeApi } from '../fixtures/api';
import { clerkLoaded, signInAs } from '../fixtures/session';
import { readWorkspaces } from '../fixtures/workspaces';

test.describe('team', () => {
  test('a member sees the workspace but not its plan or keys', async ({ browser, page, api, name }) => {
    const byAdmin = name('by admin');
    await api.createTemplate({ title: byAdmin });
    const member = await signInAs(browser, TEST_USER_2, readWorkspaces().shared);
    // The member's rows are the member's to delete: the admin's cleanup
    // would work too, but the row's owner is the one whose session should
    // be able to undo it.
    const memberApi = makeApi(member.page.request);
    try {
      await member.page.goto('/dashboard/templates');
      await expect(member.page.getByRole('link', { name: byAdmin })).toBeVisible();

      const byMember = name('by member');
      await memberApi.createTemplate({ title: byMember });
      await page.goto('/dashboard/templates');
      await expect(page.getByRole('link', { name: byMember })).toBeVisible();

      // Each page is judged only once Clerk has told it the role: what is
      // asserted here is the absence of the admin's tabs and the presence of
      // the "for admins" states, and both are what every page shows before
      // then, member or not.
      await member.page.goto('/dashboard/settings');
      await clerkLoaded(member.page);
      const tabs = member.page.getByRole('navigation', { name: 'Settings' });
      await expect(tabs.getByRole('link', { name: 'Account' })).toBeVisible();
      await expect(tabs.getByRole('link', { name: 'Team' })).toBeVisible();
      await expect(tabs.getByRole('link', { name: 'Plan' })).toHaveCount(0);
      await expect(tabs.getByRole('link', { name: 'API keys' })).toHaveCount(0);

      await member.page.goto('/dashboard/settings/plan');
      await clerkLoaded(member.page);
      await expect(member.page.getByText('Plan and billing are for admins')).toBeVisible();
      await member.page.goto('/dashboard/settings/api-keys');
      await clerkLoaded(member.page);
      await expect(member.page.getByText('API keys are for admins')).toBeVisible();

      const key = await member.page.request.post('/api/v1/api-keys', { data: { name: name('member key'), mode: 'test' } });
      expect(key.status()).toBe(403);
      expect((await key.json()).message).toBe('Only an admin can create API keys. Ask an admin on your team.');
      const checkout = await member.page.request.post('/api/v1/billing/checkout', { data: { plan: 'pro' } });
      expect(checkout.status()).toBe(403);
      expect((await checkout.json()).message).toBe('Only an admin can change the plan. Ask an admin on your team.');
    } finally {
      await memberApi.cleanup();
      await member.context.close();
    }
  });

  test('the admin has a team tab', async ({ page }) => {
    await page.goto('/dashboard/settings/team');
    const tab = page.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Team' });
    await expect(tab).toHaveAttribute('aria-current', 'page');
    // Clerk's organization profile is the page body; its member list is the
    // one thing temply relies on it showing, and its navbar entry is how the
    // list is reached. At phone width Clerk folds that navbar behind one
    // button named for the profile — exact, or the name also takes in "Leave
    // organization" and "Delete organization" further down the page — and
    // the folded navbar stays in the DOM, hidden, so the entry is found by
    // role, which skips what the reader cannot reach.
    if (test.info().project.name.startsWith('phone')) await page.getByRole('button', { name: 'Organization', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Members' })).toBeVisible();
  });
});
