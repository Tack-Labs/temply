import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignInCard } from '~/components/sign-in-card';

export default async function SignInPage() {
  const user = await currentUser();
  if (user) redirect('/dashboard/templates');
  return <SignInCard />;
}

export const dynamic = 'force-dynamic';
