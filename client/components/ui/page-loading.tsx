/**
 * The wait state for a whole page or pane: the Temply app icon with the mark's
 * three shapes breathing in turn. It is the same component behind a route
 * change (Next's loading.tsx) and a data fetch (React Query), so the two waits
 * read as one and the page never trades one spinner for another. Buttons,
 * dialogs and the picker keep their small inline spinner — that one says "this
 * action is running", this one says "the page is on its way".
 *
 * No state or effects, so the server can render it from a loading.tsx file. It
 * is the tile and not the bare gradient mark because it sits on the app
 * surface and on a template's painted canvas alike, and a tile reads on either.
 * The tile and the white mark are the pack's app icon, drawn here so the shapes
 * can move; the brand's rule against hand-edited geometry holds because the
 * shapes come from `MARK_PARTS`.
 */
import { useId } from 'react';
import { MARK_PARTS } from '~/components/brand-mark';
import { cn } from '~/lib/classname';

export function PageLoading({
  label = 'Loading…',
  className,
}: {
  /** Shown under the mark, and read by screen readers. */
  label?: string;
  className?: string;
}) {
  // See BrandMark for why only the word characters of the id stay.
  const tile = `page-loading-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <div
      role="status"
      className={cn('page-loading flex flex-col items-center justify-center gap-3 py-16', className)}
    >
      <svg viewBox="0 0 1024 1024" className="size-10" aria-hidden="true">
        <defs>
          <linearGradient id={tile} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1024" y2="1024">
            <stop offset="0" style={{ stopColor: 'var(--brand-coral)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--brand-pink)' }} />
            <stop offset="1" style={{ stopColor: 'var(--brand-purple)' }} />
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" rx="230" fill={`url(#${tile})`} />
        <g className="fill-white" transform="translate(225.28 257.14) scale(1.5929)">
          {MARK_PARTS.map((part) => (
            <path key={part} className="page-loading-bar" d={part} />
          ))}
        </g>
      </svg>
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
