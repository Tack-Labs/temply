import { createClerkClient } from '@clerk/backend';
import { TEST_USER, TEST_USER_2 } from '../env';
import type { Workspaces } from '../fixtures/workspaces';

const SECOND_WORKSPACE_NAME = 'e2e second workspace';

/**
 * The second test user's standing in Clerk, made once and kept: a member of
 * the shared workspace, and the admin of a workspace of their own. Clerk
 * holds both across runs (the app's database does not), so each step is a
 * no-op when it already holds, and nothing is ever removed — two specs read
 * this state at once and neither may pull it from under the other.
 *
 * The one write that changes standing rather than adding it is the demotion
 * to member below, and it must never land on the first user: an empty
 * E2E_USER_2_EMAIL matches no one in particular, and one equal to
 * E2E_USER_EMAIL — or any email that resolves to the signed-in user, whose
 * id the caller passes in — would strip the run's admin of their own
 * workspace, and every later checkout would be refused as admin-only.
 */
export async function ensureSecondUser(sharedOrgId: string, signedInUserId: string): Promise<Workspaces> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');
  // The dev instance is the only one this setup may write to: a production
  // key in e2e/.env or a CI secret would otherwise have the writes below —
  // a membership, a demotion, an organization — land on real customers.
  if (!secretKey.startsWith('sk_test_')) throw new Error('CLERK_SECRET_KEY must be a dev-instance key (sk_test_…)');
  if (!signedInUserId) throw new Error('the signed-in user has no id; refusing to touch anyone else\'s standing');
  if (!TEST_USER_2.email) throw new Error('E2E_USER_2_EMAIL is not set');
  if (TEST_USER_2.email === TEST_USER.email) throw new Error('E2E_USER_2_EMAIL must name a different user from E2E_USER_EMAIL');
  const clerk = createClerkClient({ secretKey });

  const users = await clerk.users.getUserList({ emailAddress: [TEST_USER_2.email] });
  const user = users.data[0];
  if (!user) throw new Error('Clerk has no user for E2E_USER_2_EMAIL');
  if (user.id === signedInUserId) throw new Error('E2E_USER_2_EMAIL resolves to the signed-in e2e user; refusing to change their standing');

  const memberships = await clerk.users.getOrganizationMembershipList({ userId: user.id, limit: 100 });
  // The role is part of the standing, not just the membership: the specs
  // that sign this user into the shared workspace assert what a member is
  // kept out of, and a membership promoted by hand in the Clerk dashboard
  // would make every one of them pass for the wrong reason.
  const shared = memberships.data.find((m) => m.organization.id === sharedOrgId);
  if (!shared) {
    await clerk.organizations.createOrganizationMembership({ organizationId: sharedOrgId, userId: user.id, role: 'org:member' });
  } else if (shared.role !== 'org:member') {
    await clerk.organizations.updateOrganizationMembership({ organizationId: sharedOrgId, userId: user.id, role: 'org:member' });
  }

  // The named workspace is preferred: a workspace the user was made admin of
  // by hand, for a look at something, would otherwise be the one the specs
  // move between Free and Pro.
  const own = memberships.data.filter((m) => m.organization.id !== sharedOrgId && m.role === 'org:admin');
  let second = (own.find((m) => m.organization.name === SECOND_WORKSPACE_NAME) ?? own[0])?.organization.id;
  if (!second) {
    const org = await clerk.organizations.createOrganization({ name: SECOND_WORKSPACE_NAME, createdBy: user.id });
    second = org.id;
  }

  return { shared: sharedOrgId, second, secondUserId: user.id };
}
