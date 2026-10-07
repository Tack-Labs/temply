import { parseStamp } from './stamp';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30.44 * DAY;

// Fixed to English: it is read inside a sentence ("edited 2 hours ago") whose
// other words are English, and a browser locale would set a German phrase
// beside them. `numeric: 'always'` keeps "1 day ago" and "1 week ago": the
// distance here is elapsed time, not calendar days, so 'auto' would call 40
// hours "yesterday" when the day it names is the one before.
const phrases = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

/**
 * How long ago something happened, to the unit a reader scanning a list
 * wants: minutes, hours, days, weeks, months, years. Elapsed time rather than
 * calendar days, so it never depends on the reader's time zone, but it does
 * depend on their clock: call it only once the page has hydrated, or the
 * server's "2 hours ago" and the browser's mismatch.
 *
 * A stamp slightly ahead of `now` (two machines never agree to the second)
 * reads as just now rather than "in 3 seconds".
 */
export function relativeTime(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const at = parseStamp(iso);
  if (Number.isNaN(at.getTime())) return null;
  const elapsed = now.getTime() - at.getTime();
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return phrases.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return phrases.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 7 * DAY) return phrases.format(-Math.floor(elapsed / DAY), 'day');
  if (elapsed < 31 * DAY) return phrases.format(-Math.floor(elapsed / (7 * DAY)), 'week');
  if (elapsed < 365 * DAY) return phrases.format(-Math.floor(elapsed / MONTH), 'month');
  return phrases.format(-Math.floor(elapsed / (365 * DAY)), 'year');
}

/**
 * The full date and time, for the tooltip that backs a relative phrase: "2
 * hours ago" is the scan, this is the answer when the reader needs the day.
 * In the reader's own locale, so it waits for hydration too.
 */
export function exactTime(
  iso: string | null,
  options: { locale?: string; timeZone?: string } = {},
): string | null {
  if (!iso) return null;
  const at = parseStamp(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleString(options.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: options.timeZone });
}
