import type { Props } from 'tippy.js';

type Modifiers = NonNullable<NonNullable<Props['popperOptions']>['modifiers']>;

/**
 * How every block menu is positioned.
 *
 * Which side a menu sits on is chosen rather than negotiated: a Section whose
 * Repeat holds the caret moves to the section's bottom edge so the two menus
 * do not ask for the same spot, and a Spacer's drops onto the block it
 * measures. So flip stays off — a menu that changed sides on its own would
 * land on the other one.
 *
 * What that left out is the pane. The canvas scrolls inside a box that starts
 * under the app header, and a menu placed above a block resting at that edge
 * was drawn above the box and clipped away: the block on screen, and the only
 * way to act on it gone. preventOverflow slides the menu along its own block
 * until it is back inside, which costs the top line of the block and keeps
 * the side the menu was given. `tether` holds it to the block, so a block
 * scrolled out of the pane still takes its menu with it.
 */
export const PLACED_INSIDE_THE_PANE: Modifiers = [
  { name: 'flip', enabled: false },
  { name: 'preventOverflow', options: { altAxis: true, padding: 8 } },
];
