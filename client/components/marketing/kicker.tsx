import type { HTMLAttributes } from 'react';
import { Badge } from '~/components/ui/surfaces';
import { cn } from '~/lib/classname';

/**
 * The pill above a section heading, saying which part of the page it opens. A
 * Badge sized to be read at arm's length rather than scanned in a table row,
 * so the section's own heading stays the one real heading. `onAccent` is the
 * outline form for the accent band, where a tinted pill would vanish into the
 * fill; its outline and label are `on-accent`, the colour the primary button
 * carries on that fill, which the contrast gate holds to 4.5:1.
 */
export function Kicker({
  onAccent = false,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { onAccent?: boolean }) {
  return (
    <Badge
      tone="accent"
      className={cn(
        'px-3.5 py-1 text-base font-semibold',
        onAccent && 'border border-on-accent bg-transparent text-on-accent',
        className,
      )}
      {...props}
    />
  );
}
