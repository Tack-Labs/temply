import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignUpCard } from '~/components/sign-up-card';

/** Sign-up on our own page. Without this route the card's "Sign up" link
 *  left for Clerk's hosted portal on another domain — a different look,
 *  no terms line, and a dev-mode handshake that did not always come back. */
export default async function SignUpPage() {
  const user = await currentUser();
  if (user) redirect('/dashboard/templates');
  return <SignUpCard />;
}

export const dynamic = 'force-dynamic';
