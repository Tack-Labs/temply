import { createClerkClient } from '@clerk/backend';
import type { OrgRole } from '../plugins/auth';

type DirectoryOrganization = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly membersCount?: number;
};

/** The directory only reads counts and organisation details, never customer users. */
export type AdminDirectory = {
  isPlatformOrganization(orgId: string): Promise<boolean>;
  hasAdminMembership(orgId: string, userId: string): Promise<boolean>;
  list(options: { limit: number; offset: number; query: string }): Promise<{
    data: DirectoryOrganization[];
    totalCount: number;
  }>;
};

function clerk() {
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}

export const clerkAdminDirectory: AdminDirectory = {
  async isPlatformOrganization(orgId) {
    const organization = await clerk().organizations.getOrganization({ organizationId: orgId });
    return organization.privateMetadata.templyAdmin === true;
  },
  async hasAdminMembership(orgId, userId) {
    const { data } = await clerk().organizations.getOrganizationMembershipList({
      organizationId: orgId, userId: [userId], limit: 1,
    });
    return data.some((membership) => membership.publicUserData?.userId === userId && membership.role === 'org:admin');
  },
  list(options) {
    return clerk().organizations.getOrganizationList({ ...options, includeMembersCount: true, orderBy: '-created_at' });
  },
};

/** Read the flag and membership afresh so revocation does not wait for a session refresh. */
export async function canViewPlatformAdmin(
  identity: { userId: string | null; orgId: string | null; orgRole: OrgRole | null },
  directory: AdminDirectory,
): Promise<boolean> {
  if (!identity.userId || !identity.orgId || identity.orgRole !== 'admin') return false;
  if (!(await directory.isPlatformOrganization(identity.orgId))) return false;
  return directory.hasAdminMembership(identity.orgId, identity.userId);
}
