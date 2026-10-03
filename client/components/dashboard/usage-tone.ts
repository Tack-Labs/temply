export type UsageTone = 'accent' | 'warn' | 'danger';

// The bar fills with the -ink colours rather than the fills. The fills are one
// blue, orange and red in both themes, and against the dark track the blue
// and the red fall under the 3:1 a graphic has to clear; the -ink colours move
// with the theme and are held to it in scripts/check-contrast.ts.
export const TONE_FILL: Record<UsageTone, string> = {
  accent: 'bg-accent-ink',
  warn: 'bg-warn-ink',
  danger: 'bg-danger-ink',
};
export const TONE_NOTE: Record<UsageTone, string> = {
  accent: 'text-muted',
  warn: 'text-warn-ink',
  danger: 'text-danger-ink',
};

/** Where "plenty of room" ends: past it the bar and its caption turn warn. */
const NEAR_LIMIT_PCT = 80;

/**
 * Whole percent of `scale` that `used` fills, held to 0-100. It rounds down so
 * 100 only ever means at or past the cap: with `Math.round`, 9,950 to 9,999 of
 * 10,000 read "100% used" with a full bar and the warn colour while the card
 * still had calls to spend. The multiply comes first because `29 / 100 * 100`
 * is 28.999… in floating point and would floor to 28.
 */
export function usagePct(used: number, scale: number): number {
  if (!(scale > 0)) return 0;
  return Math.min(100, Math.max(0, Math.floor((used * 100) / scale)));
}

/**
 * How a measured number is coloured. Danger is for a limit that blocks work,
 * and warn for what deserves a look: nearing the limit, or billed overage on a
 * plan that carries on past it. The sidebar's card and the home's tiles sit on
 * one screen and draw the same count, so both go through this and its floored
 * percentage; a second rule would put one in warn while the other is not.
 *
 * `scale` is what the bar is measured against, null where there is none.
 */
export function usageTone({
  used,
  scale,
  capped,
  over,
}: {
  used: number;
  scale: number | null;
  capped: boolean;
  over: boolean;
}): UsageTone {
  if (capped) return 'danger';
  const pct = scale ? usagePct(used, scale) : 0;
  return over || pct >= NEAR_LIMIT_PCT ? 'warn' : 'accent';
}
