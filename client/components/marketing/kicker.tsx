import type { HTMLAttributes } from 'react';
import { Badge } from '~/components/ui/surfaces';
import { cn } from '~/lib/classname';

/**
 * The pill above a section heading, saying which part of the page it opens. A
 * Badge sized to be read at arm's length rather than scanned in a table row,
 * so the section's own heading stays the one real heading.
 */
export function Kicker({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <Badge tone="accent" className={cn('px-3.5 py-1 text-base font-semibold', className)} {...props} />;
}
