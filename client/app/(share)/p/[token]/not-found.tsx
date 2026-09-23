import Link from 'next/link';
import { BrandMark } from '~/components/brand-mark';

/** A switched-off or mistyped link. Says so plainly; no login prompt, since
 *  signing in would not bring the link back. */
export default function ShareNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sunken px-6 text-center">
      <BrandMark className="size-6 text-accent" />
      <h1 className="font-display text-xl font-semibold text-ink">This link is not active</h1>
      <p className="max-w-sm text-sm text-muted">
        The person who shared it may have turned it off. Ask them for a new link.
      </p>
      <Link href="/" className="text-sm text-accent-ink underline-offset-4 hover:underline">
        Made with Temply
      </Link>
    </div>
  );
}
