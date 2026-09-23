/** Translate a scroll offset into a bounded parallax shift in px.
 *  `speed` is the fraction of scroll to apply; `max` caps the magnitude so a
 *  layer never drifts arbitrarily far. Pure so it can be unit-tested. */
export function clampedParallax(scrollY: number, speed: number, max: number): number {
  const raw = scrollY * speed;
  return Math.max(-max, Math.min(max, raw));
}
