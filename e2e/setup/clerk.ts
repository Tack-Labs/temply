import { createClerkClient } from '@clerk/backend';
import { TEST_USER_2 } from '../env';
import type { Workspaces } from '../fixtures/workspaces';

const SECOND_WORKSPACE_NAME = 'e2e second workspace';

/**
 * The second test user's standing in Clerk, made once and kept: a member of
 * the shared workspace, and the admin of a workspace of their own. Clerk
 * holds both across runs (the app's database does not), so each step is a
 * no-op when it already holds, and nothing is ever removed — two specs read
 * this state at once and neither may pull it from under the other.
 */
export async function ensureSecondUser(sharedOrgId: string): Promise<Workspaces> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');
  const clerk = createClerkClient({ secretKey });

  const users = await clerk.users.getUserList({ emailAddress: [TEST_USER_2.email] });
  const user = users.data[0];
  if (!user) throw new Error('Clerk has no user for E2E_USER_2_EMAIL');

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

  let second = memberships.data.find((m) => m.organization.id !== sharedOrgId && m.role === 'org:admin')?.organization.id;
  if (!second) {
    const org = await clerk.organizations.createOrganization({ name: SECOND_WORKSPACE_NAME, createdBy: user.id });
    second = org.id;
  }

  return { shared: sharedOrgId, second, secondUserId: user.id };
}
