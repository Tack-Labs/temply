import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SIGNED_IN_HOME, SignInCard } from '~/components/sign-in-card';

export default async function SignInPage() {
  const user = await currentUser();
  if (user) redirect(SIGNED_IN_HOME);
  return <SignInCard />;
}

export const dynamic = 'force-dynamic';
