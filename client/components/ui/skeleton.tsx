import * as React from 'react';
import { cn } from '~/lib/classname';

/**
 * One placeholder block, shaped by the className the caller gives it. It is
 * decoration: hidden from assistive tech, because a screen reader meeting
 * five of these would announce nothing useful five times. Say what is loading
 * once, on the container, with SkeletonList. The pulse is the same
 * `animate-pulse` the thumbnails already use, and is dropped for reduced
 * motion, leaving a still block.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-active motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

/**
 * The container for a group of Skeletons: it carries the `status` role and
 * the one sr-only label, so a screen reader hears "Loading templates" once
 * rather than a row at a time. Put the Skeletons inside it as children.
 *
 * A live region announces a change to its text, not text it was mounted with,
 * so a status that appears already reading "Loading templates" is announced
 * unreliably, and one unmounted when loading ends never reports the result.
 * Keep it mounted across the whole load and change `label` when it finishes
 * ("Loading templates" to "12 templates"), swapping the Skeletons for the real
 * rows inside it. There is no `aria-busy`: some screen readers hold a region's
 * updates back while it is set, and the one update this region exists to make
 * is the last.
 */
export function SkeletonList({
  label,
  className,
  children,
}: {
  /** What is loading, as a screen reader should say it: "Loading templates". */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
