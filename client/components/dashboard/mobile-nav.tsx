'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { MenuIcon, XIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { useMediaQuery } from '~/hooks/use-media-query';
import { Sidebar } from './sidebar';

/** Tailwind's `md` (48rem): from here the rail is on screen and the drawer's
 *  scrim and panel are `md:hidden`. */
const WIDE = '(min-width: 48rem)';

/**
 * Closes the drawer once the window is wide enough to hide it. Radix keeps an
 * open dialog modal whatever the CSS does to it, so a phone turned to
 * landscape with the drawer open would be left with nothing visible, a page
 * that is inert and scroll-locked, and focus held by a panel that is not
 * there. Server and hydration read `false` (see `useMediaQuery`), which is a
 * no-op: the drawer starts closed.
 */
export function useCloseWhenWide(open: boolean, setOpen: (open: boolean) => void) {
  const wide = useMediaQuery(WIDE);
  useEffect(() => {
    if (wide && open) setOpen(false);
  }, [wide, open, setOpen]);
}

/**
 * Below `md` the sidebar is hidden. Before this existed there was no
 * replacement, so a signed-in user on a phone could not move between dashboard
 * sections or sign out at all — the only way back was the URL bar.
 *
 * The drawer is the sidebar itself, so the two can never drift apart. Radix
 * keeps the dialog's content out of the tree while it is closed, which is
 * stronger than hiding it: nothing in it can take focus or be read, and
 * Escape or the scrim returns focus to the button that opened it.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A drawer that survives navigation would cover the page it just opened.
  useEffect(() => setOpen(false), [pathname]);
  useCloseWhenWide(open, setOpen);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        {/* The glyph is 16px inside its box: 32px for a fine pointer, 44px for
            a coarse one. Pulling the box back by half the difference puts the
            glyph on the page gutter, not 8px or 14px inside it. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          className="-ml-2 pointer-coarse:-ml-3.5 md:hidden"
        >
          <MenuIcon />
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay-fade fixed inset-0 z-50 bg-black/40 md:hidden" />
        {/* The drawer is its title and its links; Radix warns on every open
            unless the missing description is stated rather than implied. The
            slide and the scrim's fade are keyframes on the motion tokens,
            which the reduced-motion rule in globals.css shortens to nothing. */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="drawer-left fixed inset-y-0 left-0 z-50 w-64 shadow-xl md:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <Sidebar
            onNavigate={() => setOpen(false)}
            headerAction={
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" touch aria-label="Close navigation">
                  <XIcon />
                </Button>
              </DialogPrimitive.Close>
            }
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
