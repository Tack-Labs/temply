import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/classname';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

function DialogPortal({ ...props }: DialogPrimitive.DialogPortalProps) {
  return <DialogPrimitive.Portal {...props} />;
}
DialogPortal.displayName = DialogPrimitive.Portal.displayName;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn('overlay-fade fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]', className)}
    ref={ref}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      className={cn(
        // Positioning lives in the .dialog-pop rule so the pop keyframe can
        // carry the centring translate; no Tailwind translate utilities here.
        // A phone gets 1rem of margin on every side: the dialog is centred from
        // its own middle, so the calc width and height leave that much around
        // it, and a body taller than the viewport scrolls inside.
        'dialog-pop fixed z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md gap-4 overflow-y-auto rounded-lg border border-line bg-raised p-5 shadow-xl',
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
      {/* On a coarse pointer the close grows to 44px and moves 8px in from
          the corner, so its left edge is 52px from the dialog's edge. The
          title has to end short of that: DialogHeader's coarse padding adds
          48px to whatever the dialog pads itself with (p-5 by default, p-4
          in the compact ones), which keeps 12px or more clear of it. */}
      <DialogPrimitive.Close asChild>
        <Button variant="ghost" size="icon-sm" touch className="absolute top-4 right-4 pointer-coarse:top-2 pointer-coarse:right-2">
          <X />
          <span className="sr-only">Close</span>
        </Button>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // 32px clears the 28px close button on a fine pointer; the 44px one a
        // coarse pointer gets needs 48px, as explained beside the button.
        'flex flex-col gap-1 pr-8 pointer-coarse:pr-12',
        className
      )}
      {...props}
    />
  );
}
DialogHeader.displayName = 'DialogHeader';

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    className={cn(
      'text-base leading-none font-semibold tracking-tight text-ink',
      className
    )}
    ref={ref}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    className={cn('text-sm text-muted', className)}
    ref={ref}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
