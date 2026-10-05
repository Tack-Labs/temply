import { createClerkClient } from '@clerk/backend';
import { TEST_USER } from '../env';
import { test, expect } from '../fixtures/test';
import { signInAs } from '../fixtures/session';
import { onPhone } from '../fixtures/project';
import { readWorkspaces } from '../fixtures/workspaces';

test('the Temply organisation admin can browse signups and loses access when its flag is removed', async ({ page, browser, name }) => {
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
  let admin: Awaited<ReturnType<typeof signInAs>> | undefined;
  // Clerk rejects phone numbers in organisation names; GitHub's numeric
  // run id must stay unique without looking like a number.
  const organisationName = (what: string) => name(what).replace(/\d/g, (digit) => String.fromCharCode(97 + Number(digit)));
  const signupName = organisationName('signup');
  try {
    adminId = (await clerk.organizations.createOrganization({
      name: organisationName('main'), createdBy: user.id, privateMetadata: { templyAdmin: true },
    })).id;
    signupId = (await clerk.organizations.createOrganization({ name: signupName })).id;
    // Clerk keeps the active workspace on the session, and every worker's
    // page shares the one in the storageState. Making this workspace active
    // there would move it under whatever else is running — a library listed
    // empty, a template that is not there — so the platform admin gets a
    // session of its own.
    admin = await signInAs(browser, TEST_USER, adminId);
    const adminPage = admin.page;
    if (onPhone()) await adminPage.getByRole('button', { name: 'Open navigation' }).click();
    await adminPage.getByRole('navigation', { name: 'Dashboard' }).getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: 'Temply admin' })).toBeVisible();
    await adminPage.getByLabel('Find an organisation').fill(signupName);
    await adminPage.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: signupName })).toBeVisible();
    await expect(adminPage.getByText('Not started', { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Workspace has not been opened yet.')).toBeVisible();
    await expect(adminPage.getByText('Live API calls', { exact: true })).toBeVisible();

    const directory = await adminPage.request.get(`/api/v1/admin/organizations?q=${encodeURIComponent(signupId)}`);
    expect(directory.headers()['cache-control']).toBe('private, no-store');
    expect((await directory.json()).organizations[0]).toMatchObject({ id: signupId, members: 0, subscription: { plan: 'not-started' } });

    await adminPage.getByLabel('Find an organisation').fill(shared);
    await adminPage.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(adminPage.getByText(shared, { exact: true })).toBeVisible();
    await expect(adminPage.getByText('Enterprise', { exact: true })).toBeVisible();
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await adminPage.getByLabel('Find an organisation').fill(name('no match'));
    await adminPage.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(adminPage.getByText('No organisations found')).toBeVisible();

    await clerk.organizations.updateOrganizationMetadata(adminId, { privateMetadata: { templyAdmin: null } });
    expect((await adminPage.request.get('/api/v1/admin/organizations')).status()).toBe(403);
    await adminPage.reload();
    await expect(adminPage.getByRole('heading', { name: 'There is nothing here' })).toBeVisible();
  } finally {
    try {
      await admin?.context.close();
    } finally {
      await Promise.all([
        signupId ? clerk.organizations.deleteOrganization(signupId) : Promise.resolve(),
        adminId ? clerk.organizations.deleteOrganization(adminId) : Promise.resolve(),
      ]);
    }
  }
});
