import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '~/components/brand-mark';
import { Button } from '~/components/ui/button';

export const metadata: Metadata = { title: 'Page not found', robots: 'noindex' };

/** A route that does not exist. Two ways out — home for a visitor, the
 *  dashboard for someone signed in — since the page cannot know which the
 *  reader is. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <BrandMark className="size-6 text-accent" />
      <h1 className="font-display text-xl font-semibold text-ink">There is nothing here</h1>
      <p className="max-w-sm text-sm text-muted">
        The address may be mistyped, or the page has moved.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="primary" asChild>
          <Link href="/dashboard">Open the dashboard</Link>
        </Button>
        <Button asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
