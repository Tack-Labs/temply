'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ErrorState } from '~/components/ui/surfaces';
import { cn } from '~/lib/classname';

/**
 * ErrorState for data a server component fetched. Its retry is a refresh of
 * the route, which runs the fetches again; ErrorState itself only draws a
 * retry button when handed a function, and a server component cannot hand it
 * one. ErrorState has no pending state of its own, so the wrapper dims while
 * the refresh runs, and ignores a second press until it settles.
 *
 * A retry that fails leaves this component mounted with the same props, so
 * nothing on the page would say it had run. The line under the card does: it
 * is a live region that stays mounted, since one announces a change to its
 * text and not text it was mounted with, and it says nothing until a retry
 * has been pressed, so the error is not announced a second time on arrival. A
 * retry that works unmounts this, taking the line with it. The line sits
 * outside the dimmed wrapper because `aria-busy` on an ancestor holds a live
 * region's announcements back until it clears.
 */
export function RefreshErrorState({ title, description }: { title?: string; description: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retried, setRetried] = useState(false);

  const outcome = pending ? 'Trying again…' : retried ? 'Still could not load. Try again in a moment.' : '';

  return (
    <div>
      <div
        aria-busy={pending || undefined}
        className={cn(
          'transition-opacity duration-base ease-out motion-reduce:transition-none',
          pending && 'pointer-events-none opacity-60',
        )}
      >
        <ErrorState
          title={title}
          description={description}
          onRetry={() => {
            if (pending) return;
            setRetried(true);
            startTransition(() => router.refresh());
          }}
        />
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-base ease-out motion-reduce:transition-none',
          outcome ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {/* The gap is padding, not a margin on the track, so it closes with it. */}
          <p role="status" className="pt-2 text-center text-xs text-muted">
            {outcome}
          </p>
        </div>
      </div>
    </div>
  );
}
