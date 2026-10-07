import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLogo } from '~/components/brand-logo';
import { Clerk } from '~/components/clerk';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * The shell both auth screens share: the brand above the card, the terms
 * below it. Consent is collected by Clerk during sign-up; the line makes
 * the terms visible before the button is pressed, which is what the terms
 * themselves say happens. Both open in a new tab, as Clerk's own consent
 * links do, so a half-filled form is not lost to a click.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Clerk>
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4">
        <Link href="/" aria-label="Temply" className="flex min-h-11 items-center rounded-md">
          <BrandLogo className="h-8.75 w-auto" />
        </Link>
        {children}
        <p className="max-w-xs text-center text-xs text-muted">
          By continuing you agree to the{' '}
          <Link href="/terms" target="_blank" className="text-accent-ink underline-offset-4 hover:underline">
            terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" target="_blank" className="text-accent-ink underline-offset-4 hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </main>
    </Clerk>
  );
}
