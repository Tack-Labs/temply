'use client';

import { SignUp } from '@clerk/nextjs';
import { useTheme } from '~/components/theme-provider';

export function SignUpCard() {
  const { clerkAppearance } = useTheme();

  return (
    <SignUp
      signInUrl="/login"
      forceRedirectUrl="/onboarding"
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
