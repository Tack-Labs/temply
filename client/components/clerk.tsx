import { ClerkProvider } from '@clerk/nextjs';

/**
 * Clerk, for the pages that have a session to show: the dashboard, the
 * editor, onboarding, the sign-in and sign-up screens, and the marketing
 * header's menu once a visitor turns out to be signed in.
 *
 * Not in the root layout. Wrapping everything put Clerk's client in the
 * script every page carries, and the front page, the docs and the legal
 * pages have nothing to ask it — they are prerendered and read no session.
 * The props travel with the provider so the two layouts that mount it
 * cannot drift apart.
 */
export function Clerk({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      // Signing out — and deleting the account, which signs out — lands on
      // the front page, not on whatever settings sub-path Clerk was showing.
      afterSignOutUrl="/"
      // A finished sign-up goes to the dashboard wherever the flow ran —
      // the card on /login or Clerk's own verification screens — and so
      // does a sign-in that arrived with nowhere particular to return to.
      // Without these Clerk falls back to "/", the marketing page.
      signUpForceRedirectUrl="/onboarding"
      signInFallbackRedirectUrl="/dashboard"
      // Clerk otherwise titles its screens after the instance name, so the
      // sign-in page for Temply read "Sign in to My Application".
      localization={{
        signIn: {
          start: {
            title: 'Sign in to Temply',
            subtitle: 'Pick up where you left off.',
          },
        },
        signUp: {
          start: {
            title: 'Create your Temply account',
            subtitle: 'Save the emails you build and send them from your own app.',
          },
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
