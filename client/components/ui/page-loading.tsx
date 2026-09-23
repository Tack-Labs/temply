/**
 * The wait state for a whole page or pane: the Temply mark with its three bars
 * breathing in turn. It is the same component behind a route change (Next's
 * loading.tsx) and a data fetch (React Query), so the two waits read as one
 * and the page never trades one spinner for another. Buttons, dialogs and the
 * picker keep their small inline spinner — that one says "this action is
 * running", this one says "the page is on its way".
 *
 * No hooks, so the server can render it from a loading.tsx file. The colours
 * are the brand mark's own (the favicon uses the same geometry), which is why
 * it can sit on the app surface and on a template's painted canvas alike.
 */
import { cn } from '~/lib/classname';

export function PageLoading({
  label = 'Loading…',
  className,
}: {
  /** Shown under the mark, and read by screen readers. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn('page-loading flex flex-col items-center justify-center gap-3 py-16', className)}
    >
      <svg viewBox="0 0 48 48" className="size-10" aria-hidden="true">
        <rect width="48" height="48" rx="11" className="fill-accent" />
        <g className="fill-white" transform="translate(6.72 6.72) scale(0.72)">
          <rect className="page-loading-bar" x="6" y="7" width="36" height="9.5" rx="3.5" />
          <rect className="page-loading-bar" x="13" y="20.5" width="22" height="9.5" rx="3.5" />
          <rect className="page-loading-bar" x="19" y="34" width="10" height="9.5" rx="3.5" />
        </g>
      </svg>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
