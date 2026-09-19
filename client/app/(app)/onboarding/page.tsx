import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { CreateWorkspace } from '~/components/onboarding/create-workspace';

export const metadata: Metadata = { title: 'Set up your workspace', robots: 'noindex' };

/** Step one: name the organization. Someone who already has one has no
 *  business here and goes to the dashboard. */
export default async function OnboardingPage() {
  const { orgId } = await auth();
  if (orgId) redirect('/dashboard');
  return <CreateWorkspace />;
}
