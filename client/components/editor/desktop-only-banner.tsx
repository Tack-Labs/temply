'use client';

import { MonitorIcon } from 'lucide-react';

/**
 * Why the canvas below does not answer a tap.
 *
 * Not dismissible on purpose: dismissing it would leave a canvas that
 * ignores every touch with nothing on screen to say why, which is the state
 * this banner exists to prevent. `accent` and not `warn` — nothing has gone
 * wrong, the tool simply lives somewhere else. The shape is the save-failure
 * strip's, a row under the header rather than a card in the flow, because it
 * belongs to the canvas and not to the document.
 */
export function DesktopOnlyBanner({ playground }: { playground: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-line bg-accent-wash px-2 py-1.5">
      <MonitorIcon className="size-4 shrink-0 text-accent-ink" aria-hidden />
      <p className="min-w-0 flex-1 text-xs text-accent-ink">
        {playground ? (
          'Open on a desktop to try the editor.'
        ) : (
          <>
            <span className="font-medium">Editing is on desktop.</span>{' '}
            Details, preview and publishing still work here.
          </>
        )}
      </p>
    </div>
  );
}
