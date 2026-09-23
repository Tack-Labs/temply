'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { MenuIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { Button, pressable } from '~/components/ui/button';
import { cn } from '~/lib/classname';
import { BrandMark } from '~/components/brand-mark';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NavLinks } from './nav-items';
import { WorkspaceSwitcher } from './sidebar';
import { QuotaWidget } from './quota-widget';
import { UserMenu } from './user-menu';

/**
 * Below `md` the sidebar is hidden. Before this existed there was no
 * replacement, so a signed-in user on a phone could not move between dashboard
 * sections or sign out at all — the only way back was the URL bar.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A drawer that survives navigation would cover the page it just opened.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        {/* The button box is wider than its glyph; pulling it back by the
            box padding puts the glyph on the page gutter, not 8px inside it. */}
        <Button variant="ghost" size="icon" aria-label="Open navigation" className="-ml-2 md:hidden">
          <MenuIcon />
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay-fade fixed inset-0 z-50 bg-black/40 md:hidden" />
        {/* The drawer is its title and its links; Radix warns on every open
            unless the missing description is stated rather than implied. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="drawer-left fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-rail-bg text-rail-ink shadow-xl md:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>

          <div className="flex h-12 items-center justify-between border-b border-rail-line pr-2.5 pl-5">
            <div className="flex items-center gap-2">
              <BrandMark className="size-4.5 text-rail-active-ink" />
              <Link href="/dashboard" className="font-display text-base font-semibold tracking-tight text-rail-ink">
                Temply
              </Link>
            </div>
            <DialogPrimitive.Close
              aria-label="Close navigation"
              className={cn(
                'flex size-8 items-center justify-center rounded-md text-rail-muted hover:bg-rail-hover hover:text-rail-ink',
                pressable,
              )}
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="border-b border-rail-line p-2.5">
            <WorkspaceSwitcher />
          </div>

          <div className="flex-1 overflow-y-auto p-2.5">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>

          <div className="space-y-2 border-t border-rail-line p-2.5">
            <QuotaWidget />
            <UserMenu align="start" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
