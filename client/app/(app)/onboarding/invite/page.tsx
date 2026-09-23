import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { InviteTeammates } from '~/components/onboarding/invite-teammates';

export const metadata: Metadata = { title: 'Invite your team', robots: 'noindex' };

/** Step two, optional: a few email addresses. Needs an organization to
 *  invite into; without one, back to step one. */
export default async function OnboardingInvitePage() {
  const { orgId } = await auth();
  if (!orgId) redirect('/onboarding');
  return <InviteTeammates />;
}
