import { createClerkClient } from '@clerk/backend';
import { TEST_USER } from '../env';
import { test, expect } from '../fixtures/test';
import { activateWorkspace } from '../fixtures/session';
import { onPhone } from '../fixtures/project';
import { readWorkspaces } from '../fixtures/workspaces';

test('the Temply organisation admin can browse signups and loses access when its flag is removed', async ({ page, name }) => {
  test.setTimeout(120_000);
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey?.startsWith('sk_test_')) throw new Error('Admin e2e writes require a Clerk dev-instance key');
  const clerk = createClerkClient({ secretKey });
  const user = (await clerk.users.getUserList({ emailAddress: [TEST_USER.email] })).data[0];
  expect(user, 'the signed-in test user exists').toBeTruthy();
  const shared = readWorkspaces().shared;

  // Ordinary workspace admins have no platform access, even by a direct URL.
  expect((await page.request.get('/api/v1/admin/organizations')).status()).toBe(403);
  await page.goto('/dashboard/admin');
  await expect(page.getByRole('heading', { name: 'There is nothing here' })).toBeVisible();

  let adminId: string | undefined;
  let signupId: string | undefined;
  const signupName = name('signup');
  try {
    adminId = (await clerk.organizations.createOrganization({
      name: name('main'), createdBy: user.id, privateMetadata: { templyAdmin: true },
    })).id;
    signupId = (await clerk.organizations.createOrganization({ name: signupName })).id;
    await activateWorkspace(page, adminId);
    if (onPhone()) await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('navigation', { name: 'Dashboard' }).getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Temply admin' })).toBeVisible();
    await page.getByLabel('Find an organisation').fill(signupName);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByRole('heading', { name: signupName })).toBeVisible();
    await expect(page.getByText('Not started', { exact: true })).toBeVisible();
    await expect(page.getByText('Workspace has not been opened yet.')).toBeVisible();
    await expect(page.getByText('Live API calls', { exact: true })).toBeVisible();

    const directory = await page.request.get(`/api/v1/admin/organizations?q=${encodeURIComponent(signupId)}`);
    expect(directory.headers()['cache-control']).toBe('private, no-store');
    expect((await directory.json()).organizations[0]).toMatchObject({ id: signupId, members: 0, subscription: { plan: 'not-started' } });

    await page.getByLabel('Find an organisation').fill(shared);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText(shared, { exact: true })).toBeVisible();
    await expect(page.getByText('Enterprise', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByLabel('Find an organisation').fill(name('no match'));
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('No organisations found')).toBeVisible();

    await clerk.organizations.updateOrganizationMetadata(adminId, { privateMetadata: { templyAdmin: null } });
    expect((await page.request.get('/api/v1/admin/organizations')).status()).toBe(403);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'There is nothing here' })).toBeVisible();
  } finally {
    try {
      await activateWorkspace(page, shared);
    } finally {
      await Promise.all([
        signupId ? clerk.organizations.deleteOrganization(signupId) : Promise.resolve(),
        adminId ? clerk.organizations.deleteOrganization(adminId) : Promise.resolve(),
      ]);
    }
  }
});
