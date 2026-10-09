'use client';

import { cn } from '~/lib/classname';

/**
 * What the email looks like underneath — the HTML for anyone pasting it into
 * their own sending code, or the text alternative a client without markup
 * would show.
 */
export function ContentSource({
  source,
  wrap = false,
  className,
  minHeight,
}: {
  source: string;
  /** Text has no long unbreakable lines to preserve, so it wraps to the pane
   *  instead of scrolling sideways the way indented markup has to. */
  wrap?: boolean;
  className?: string;
  minHeight?: number;
}) {
  return (
    <div
      className={cn('flex flex-col bg-sunken p-3.5', className)}
      style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}
    >
      <pre
        className={cn(
          'flex-1 overflow-auto rounded-xl border border-line bg-raised p-4 font-mono text-sm leading-relaxed text-ink',
          wrap && 'break-words whitespace-pre-wrap'
        )}
      >
        <code>{source}</code>
      </pre>
    </div>
  );
}
