'use client';

import { SignIn, useAuth } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { useTheme } from '~/components/theme-provider';
import { SIGNED_IN_HOME } from '~/lib/routes';

const BOUNCE_KEY = 'temply:login-bounce';
const BOUNCE_WINDOW_MS = 15_000;

/**
 * Takes someone Clerk already knows on to the dashboard, with a full page load.
 *
 * The server judges the session cookie, which lasts about a minute and is
 * renewed only when a page is requested or while Clerk's own client is
 * running. A client-side visit to the dashboard with the cookie expired is
 * read as signed out and lands here, where Clerk's client knows better: it
 * draws no card for someone signed in, and its own redirect goes through the
 * router, which asks the server with the same expired cookie and can be sent
 * straight back. A full load lets Clerk's middleware renew the session first.
 *
 * Only the state at load counts, so someone who signs in on this page is not
 * pulled away from the card's own redirect. The stamp keeps a server that
 * still refuses the session from looping this page against the dashboard: a
 * second arrival inside the window stays where it is.
 */
function useLeaveWhenAlreadySignedIn() {
  const { isLoaded, isSignedIn } = useAuth();
  const decided = useRef(false);

  useEffect(() => {
    if (!isLoaded || decided.current) return;
    decided.current = true;
    if (!isSignedIn) return;
    try {
      if (Date.now() - Number(sessionStorage.getItem(BOUNCE_KEY)) < BOUNCE_WINDOW_MS) return;
      sessionStorage.setItem(BOUNCE_KEY, String(Date.now()));
    } catch {
      // Storage blocked: go without the stamp rather than stay on a blank card.
    }
    window.location.replace(SIGNED_IN_HOME);
  }, [isLoaded, isSignedIn]);
}

export function SignInCard() {
  const { clerkAppearance } = useTheme();
  useLeaveWhenAlreadySignedIn();

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
