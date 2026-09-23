'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/editor/utils/classname';

// Explicit type annotations to avoid TS2742 errors
const TooltipProvider: React.FC<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>
> = TooltipPrimitive.Provider;

const Tooltip: React.FC<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>
> = TooltipPrimitive.Root;

const TooltipTrigger: React.FC<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
> = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'mly:z-50 mly:overflow-hidden mly:rounded-md mly:border mly:border-gray-200 mly:bg-panel mly:px-2 mly:py-1 mly:text-xs mly:animate-in mly:fade-in-0 mly:zoom-in-95',
      className
    )}
    {...props}
  />
)) as React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> &
    React.RefAttributes<React.ElementRef<typeof TooltipPrimitive.Content>>
>;

TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/**
 * A tooltip that is also the name of what it wraps.
 *
 * Radix points a trigger at its tooltip with `aria-describedby`, and a
 * description is not a name: an icon-only control wrapped in a plain tooltip
 * is announced as "button" and nothing else. Nearly every control in this
 * editor is an icon with a tooltip — the colour pickers, the alignment and
 * direction switches, the link fields, the tabs — so the name comes from the
 * same string the pointer is shown, rather than from a second one somebody
 * has to keep in step. A per-control `aria-label` list is how that drifts.
 *
 * The label reaches the control itself through `asChild`, so anything that
 * carries an `aria-label` of its own keeps it.
 */
export function TooltipLabel({
  label,
  sideOffset = 8,
  children,
}: {
  label: string;
  sideOffset?: number;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild aria-label={label}>
        {children}
      </TooltipTrigger>
      <TooltipContent sideOffset={sideOffset}>{label}</TooltipContent>
    </Tooltip>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
