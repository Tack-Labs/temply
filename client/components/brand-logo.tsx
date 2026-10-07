import { cn } from '~/lib/classname';

// The pack's horizontal lockups are 1213.66 by 320. The attributes are whole
// numbers and only hold the aspect ratio while the file loads, so nothing
// shifts; the size on screen comes from the class.
const WIDTH = 1214;
const HEIGHT = 320;

/**
 * The Temply lockup, mark and wordmark together. The wordmark is outlined Inter
 * and is shown as the pack's own file, never retyped in another face. There are
 * two files, navy letters for a light surface and white for a dark one, and the
 * app's `.dark` class picks between them, so the swap happens in the first
 * paint rather than after hydration. In forced colours the page is painted
 * from the system's Canvas, not the app's theme, and an image keeps its own
 * colours, so there the system's scheme picks instead: a light app theme on a
 * black Canvas would otherwise leave navy letters on black. The one that is
 * not shown is `display: none`, which takes it out of the accessibility tree
 * and leaves a reader the name once. The link that wraps this names itself
 * with `aria-label`, because a render without the stylesheet sees both images.
 * Size it by height with `w-auto`. No class here reads a theme or brand token:
 * the colours are in the files.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/brand/temply-logo-horizontal.svg"
        alt="Temply"
        width={WIDTH}
        height={HEIGHT}
        className={cn('block not-forced-colors:dark:hidden forced-dark:hidden', className)}
      />
      <img
        src="/brand/temply-logo-horizontal-on-dark.svg"
        alt="Temply"
        width={WIDTH}
        height={HEIGHT}
        className={cn('hidden not-forced-colors:dark:block forced-dark:block', className)}
      />
    </>
  );
}
