'use client';

import { OrganizationProfile } from '@clerk/nextjs';
import { useTheme } from '~/components/theme-provider';

/**
 * Members, invitations and roles are Clerk's, embedded the way the Account
 * tab embeds UserProfile. Clerk shows the invite and role controls to admins
 * only; a member sees the list.
 */
export default function TeamPage() {
  const { clerkAppearance } = useTheme();
  return (
    <div className="space-y-5">
      <OrganizationProfile
        routing="path"
        path="/dashboard/settings/team"
        appearance={{
          ...clerkAppearance,
          elements: {
            ...(clerkAppearance.elements as Record<string, string>),
            rootBox: 'w-full',
            cardBox: 'w-full shadow-none border border-line rounded-lg',
            card: 'w-full shadow-none',
          },
        }}
      />
    </div>
  );
}
