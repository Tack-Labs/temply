'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import { useContext } from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/classname';
import { ShellFrameContext } from './shell-context';

/**
 * A panel that rises from the bottom of a phone screen. Radix Dialog does
 * the focus trap, the escape key and the overlay; the sheet adds the
 * slide, a close button and two heights. Half leaves the canvas visible
 * above it so a colour change is seen as it is made. No grab handle: a
 * handle promises drag-to-dismiss, which is phase 2, and a promise the
 * sheet cannot keep is worse than a button that can.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  showTitle = true,
  height = 'half',
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  showTitle?: boolean;
  height?: 'half' | 'full';
  children: React.ReactNode;
}) {
  // Rendered inside the shell's frame, not on the page: the frame is sized
  // to the visual viewport, so a sheet holding a text field rises with the
  // keyboard instead of being covered by it. Percent heights are of the
  // frame for the same reason.
  const frame = useContext(ShellFrameContext);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={frame ?? undefined}>
        <DialogPrimitive.Overlay className={cn('overlay-fade z-50 bg-black/40', frame ? 'absolute inset-0' : 'fixed inset-0')} />
        <DialogPrimitive.Content
          // The sheet's own title is the whole description; Radix warns on
          // every open unless the absence is stated rather than left implied.
          aria-describedby={undefined}
          // The sheets are full of icon-only controls whose only label is a
          // tooltip, and Radix opens a tooltip on focus — so letting the
          // dialog focus its first control pops an unanchored tooltip over
          // the sheet the moment it appears, and an input would raise the
          // keyboard over the sheet besides. Focus the sheet itself; the
          // focus trap and Escape are unaffected.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          className={cn(
            'sheet-up inset-x-0 bottom-0 z-50 flex flex-col rounded-t-xl border-t border-line bg-raised shadow-xl outline-none',
            frame ? 'absolute' : 'fixed',
            // The height transition covers a sheet growing when Advanced opens.
            'transition-[max-height] duration-base ease-out motion-reduce:transition-none',
            height === 'half' ? (frame ? 'max-h-[55%]' : 'max-h-[55dvh]') : frame ? 'max-h-[92%]' : 'max-h-[92dvh]',
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 pt-1 pr-1 pl-4">
            <DialogPrimitive.Title className={cn('py-2 text-sm font-medium text-ink', !showTitle && 'sr-only')}>
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="ml-auto size-11" aria-label="Close">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {/* 16px in every field: smaller text makes iOS zoom the page on focus. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&_input]:text-lg [&_textarea]:text-lg">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
