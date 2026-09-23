'use client';

import { SignIn } from '@clerk/nextjs';
import { useTheme } from '~/components/theme-provider';

export function SignInCard() {
  const { clerkAppearance } = useTheme();

  return (
    <SignIn
      signUpUrl="/sign-up"
      forceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/onboarding"
      appearance={{
        ...clerkAppearance,
        elements: {
          ...(clerkAppearance.elements as Record<string, string>),
          cardBox: 'shadow-none border border-line rounded-lg',
          card: 'shadow-none',
        },
      }}
    />
  );
}
