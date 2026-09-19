'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';
import { Clerk } from '~/components/clerk';
import { UserMenu } from '~/components/dashboard/user-menu';

/** Tells the header when Clerk, now loaded, disagrees with the cookie. */
function Resolved({ onSignedOut }: { onSignedOut: () => void }) {
  const { isLoaded, isSignedIn } = useUser();
  useEffect(() => {
    if (isLoaded && !isSignedIn) onSignedOut();
  }, [isLoaded, isSignedIn, onSignedOut]);
  return null;
}

/**
 * The marketing header's account menu, with the Clerk it needs brought
 * along. The header decides from a cookie whether anyone is signed in and
 * loads this only then, so a visitor who is not never fetches Clerk to be
 * shown a Sign in button. The cookie is a hint: once Clerk has loaded and
 * says the session is gone, the header hears it and shows Sign in.
 */
export default function HeaderUserMenu({ onSignedOut }: { onSignedOut: () => void }) {
  return (
    <Clerk>
      <Resolved onSignedOut={onSignedOut} />
      <UserMenu align="end" showLabel={false} surface="page" />
    </Clerk>
  );
}
