'use client';

import { AlertTriangleIcon, CheckIcon, Loader2Icon } from 'lucide-react';
import type { AutosaveStatus } from '~/lib/autosave';
import { cn } from '~/lib/classname';
import { Button } from './ui/button';

/**
 * What the autosave has to say, and nothing when it has nothing. Idle and
 * dirty say nothing — the pause is short and a flicker of "unsaved" on every
 * keystroke is noise; the word appears once a save is under way and stays as
 * "Saved". A failure is the only state that asks for anything, and it asks
 * with a button.
 *
 * The word and the announcement are two elements on purpose. A live region is
 * read whatever its opacity, so the one that used to carry both said "Saved"
 * on a template nobody had touched — `idle` fell through to the same branch
 * as `saved` and was merely faded out. The visible word stays through the
 * fade, so the strip leaves rather than blinking out, and is `aria-hidden`
 * because the live region beside it is the half a reader hears; Retry sits
 * outside both, being a control rather than a status.
 *
 * The icon is the same three-way split so the states read at a glance: a
 * spinner while it works, a check in the success colour once it has landed,
 * an alert in the danger colour when it has not. They share one box and
 * cross-fade, so the strip never changes width as the state turns over.
 */
export function SaveStatus({ status, onRetry, className }: { status: AutosaveStatus; onRetry: () => void; className?: string }) {
  const visible = status === 'saving' || status === 'saved' || status === 'error';
  const word = status === 'error' ? 'Not saved' : status === 'saving' ? 'Saving…' : 'Saved';
  const icon =
    'absolute inset-0 size-3.5 transition-opacity duration-base ease-out motion-reduce:transition-none';
  return (
    <span className={cn('flex items-center gap-1 text-xs', className)}>
      <span
        aria-hidden
        className={cn(
          'flex items-center gap-1 transition-opacity duration-base ease-out motion-reduce:transition-none',
          visible ? 'opacity-100' : 'opacity-0',
          status === 'error' ? 'text-danger-ink' : 'text-muted',
        )}
      >
        <span className="relative size-3.5 shrink-0">
          <Loader2Icon
            className={cn(icon, status === 'saving' ? 'animate-spin opacity-100 motion-reduce:animate-none' : 'opacity-0')}
          />
          <CheckIcon
            className={cn(icon, 'text-success-ink', status === 'saved' || status === 'idle' ? 'opacity-100' : 'opacity-0')}
          />
          <AlertTriangleIcon className={cn(icon, status === 'error' ? 'opacity-100' : 'opacity-0')} />
        </span>
        {word}
      </span>
      {status === 'error' ? (
        // `h-auto` keeps it the height of its text beside the title for a
        // mouse; `touch` is what lifts it to 44px, and the width with it, for
        // a thumb. It takes the strip's own size, not the button's: the editor
        // header sets the strip larger than the default, and a Retry left at
        // the button's small size read as a smaller word than "Not saved".
        <Button variant="link" size="sm" touch className="h-auto px-1 text-[length:inherit] pointer-coarse:min-w-11" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
      <span className="sr-only" role="status">
        {visible ? word : ''}
      </span>
    </span>
  );
}
