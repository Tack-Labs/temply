'use client';

import { SignUp } from '@clerk/nextjs';
import { authElements } from '~/components/auth-appearance';
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
          ...(clerkAppearance.elements as Record<string, unknown>),
          ...authElements,
        },
      }}
    />
  );
}
