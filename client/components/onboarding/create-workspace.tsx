'use client';

import { CreateOrganization } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useTheme } from '~/components/theme-provider';
import { Button } from '~/components/ui/button';
import { CONTACT_EMAIL } from '~/lib/site';

export function WorkspaceSetupFallback() {
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setUnavailable(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  if (!unavailable) return <p role="status" className="text-center text-sm text-muted">Loading workspace setup...</p>;

  return (
    <div role="alert" className="space-y-3 rounded-lg border border-line bg-raised p-4 text-center">
      <p className="text-sm text-ink">Workspace setup could not load.</p>
      <p className="text-sm text-muted">
        Try again or{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-ink underline">contact support</a>.
      </p>
      <Button size="compact" variant="secondary" onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}

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
        <h1 className="font-display text-xl font-semibold tracking-display text-ink">Name your workspace</h1>
        <p className="mt-1 text-sm text-muted">
          Your templates, brands and API keys live here. Usually your company's name.
        </p>
      </div>
      <CreateOrganization
        // This page has a separate invite route, so Clerk's substeps use the hash.
        routing="hash"
        afterCreateOrganizationUrl="/onboarding/invite"
        skipInvitationScreen
        fallback={<WorkspaceSetupFallback />}
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
