/**
 * What `scrollIntoView` should be told for a scroll the reader did not make
 * with their hands. The editor's frame is the scroller and carries no
 * `scroll-behavior` of its own (the stylesheet's smooth scrolling is on
 * `html`, which is not the box being scrolled), so a call that leaves
 * `behavior` out always jumps.
 * Easing is asked for only where the rest of the app eases: once the page has
 * raised `html[data-smooth-scroll]` and the reader has not asked for reduced
 * motion. Before the flag a scroll is aimed at a layout the web fonts have
 * not finished moving, which is the race the flag exists to avoid.
 */
function behaviour(): ScrollBehavior {
  const ready = document.documentElement.hasAttribute('data-smooth-scroll');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return ready && !reduced ? 'smooth' : 'auto';
}

/**
 * Brings the preflight panel's header into view, for the status card in the
 * Email settings rail: the card floats beside the canvas and the panel is
 * at the top of the email, so with the canvas scrolled a click on the card
 * would open a list nobody can see.
 *
 * The header is the first disclosure in the email's article. It is found
 * there rather than by its text so the panel's markup stays its own, and the
 * header does not move while the list opens beneath it, so there is nothing
 * to wait a frame for. `nearest` leaves the canvas where it is when the
 * header is already on screen.
 */
export function revealPreflight(canvas: ParentNode | null): void {
  const header = canvas?.querySelector<HTMLElement>('article button[aria-expanded]');
  header?.scrollIntoView({ block: 'nearest', behavior: behaviour() });
}
