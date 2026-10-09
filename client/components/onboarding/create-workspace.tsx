'use client';

import { CreateOrganization } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { authElements } from '~/components/auth-appearance';
import { useTheme } from '~/components/theme-provider';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/surfaces';
import { CONTACT_EMAIL } from '~/lib/site';

export function WorkspaceSetupFallback() {
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setUnavailable(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  if (!unavailable) return <p role="status" className="text-center text-base text-muted">Loading workspace setup...</p>;

  return (
    <Card role="alert" className="flex flex-col items-center gap-4 text-center">
      <div>
        <p className="text-lg font-bold text-ink">Workspace setup could not load.</p>
        <p className="mt-1 text-base text-muted">
          Try again or{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-accent-ink underline-offset-4 transition-colors duration-fast ease-out hover:underline motion-reduce:transition-none"
          >
            contact support
          </a>
          .
        </p>
      </div>
      <Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>
    </Card>
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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-display text-balance text-ink">Name your workspace</h1>
        <p className="mt-2 text-base text-pretty text-muted">
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
          // The sign-in card's dress, at the column's width rather than its own.
          elements: {
            ...(clerkAppearance.elements as Record<string, unknown>),
            ...authElements,
            rootBox: { width: '100%' },
            cardBox: { ...(authElements.cardBox as Record<string, unknown>), width: '100%' },
          },
        }}
      />
    </div>
  );
}
