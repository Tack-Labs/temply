'use client';

import { CreateOrganization } from '@clerk/nextjs';
import { useTheme } from '~/components/theme-provider';

/**
 * Clerk's own form, dressed in our theme. It creates the organization and
 * makes it active in the same step, so the invite screen that follows —
 * and every API call after it — already has a workspace.
 */
export function CreateWorkspace() {
  const { clerkAppearance } = useTheme();
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-ink">Name your workspace</h1>
        <p className="mt-1 text-sm text-muted">
          Your templates, brands and API keys live here. Usually your company's name.
        </p>
      </div>
      <CreateOrganization
        afterCreateOrganizationUrl="/onboarding/invite"
        skipInvitationScreen
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
