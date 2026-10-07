import type { ReactNode } from 'react';

/** The plate the hero's showreel sits on: a lavender panel with a peach disc
 *  over its top-right corner, both drawn from the wash tokens so they retune
 *  with the theme. The two are decoration, so they are aria-hidden and take no
 *  pointer; the showreel above them keeps its own accessible name. The disc
 *  comes first in the source, so the reel paints over it, and on a phone it is
 *  held inside the page gutter so it never adds to the page's width.
 *
 *  The reel's canvas is the email's own white in both themes, so on the dark
 *  theme's lavender it reads as a white page on a dark plate, as it should. */
export function HeroBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-panel bg-accent-wash px-4 py-9 sm:px-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-5 -right-2 size-24 rounded-full bg-peach-wash md:-top-7 md:-right-6 md:size-36"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
