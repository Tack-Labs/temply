'use client';

import { useEffect } from 'react';
import { BrandMark } from '~/components/brand-mark';
import { Button } from '~/components/ui/button';
import { reportError } from '~/lib/report-error';

/**
 * A render or data error anywhere under the root layout. The layout itself
 * survives, so the reader keeps the app's frame; this is the page inside it.
 * `reset` re-renders the segment, which is the right first try for a fetch
 * that failed once.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <BrandMark className="size-6 text-accent" />
      <h1 className="font-display text-xl font-semibold tracking-display text-ink">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted">
        This page could not be shown. Your work is saved as you type, so nothing is lost.
        {error.digest ? (
          <>
            {' '}
            Reference <code className="font-mono text-xs">{error.digest}</code>.
          </>
        ) : null}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button size="compact" variant="primary" onClick={reset}>
          Try again
        </Button>
        <Button size="compact" asChild>
          {/* A full page load, so an expired session is renewed on the way. */}
          <a href="/dashboard">Open the dashboard</a>
        </Button>
      </div>
    </div>
  );
}
