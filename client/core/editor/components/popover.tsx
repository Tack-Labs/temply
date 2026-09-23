'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '../utils/classname';

const Popover: React.FC<
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>
> = PopoverPrimitive.Root;

const PopoverTrigger: React.FC<
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
> = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    portal?: boolean;
  }
>(
  (
    { className, align = 'center', sideOffset = 4, portal = false, ...props },
    ref
  ) => {
    const content = (
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          // A popover opened from inside a heading is still a form, not a
          // heading: reset the type it would otherwise inherit from the node
          // it sits in, since it is not portaled out of the document.
          'mly:z-9999 mly:w-72 mly:rounded-md mly:border mly:border-gray-200 mly:bg-panel mly:p-4 mly:text-sm mly:font-normal mly:leading-normal mly:not-italic mly:text-gray-950 mly:shadow-md ',
          'mly-editor',
          className
        )}
        {...props}
      />
    );

    if (!portal) {
      return content;
    }

    return <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal>;
  }
);

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
