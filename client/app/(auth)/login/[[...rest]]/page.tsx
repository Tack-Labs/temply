import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignInCard } from '~/components/sign-in-card';
import { SIGNED_IN_HOME } from '~/lib/routes';

export default async function SignInPage() {
  const user = await currentUser();
  if (user) redirect(SIGNED_IN_HOME);
  return <SignInCard />;
}

export const dynamic = 'force-dynamic';
