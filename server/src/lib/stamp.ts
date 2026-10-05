let last = 0;

/**
 * An ISO timestamp that is strictly later than the previous one this process
 * handed out. The template row tells "unpublished changes" from the equality
 * of two stamps, so two writes landing in the same millisecond — a publish
 * and a draft save from a fast client, every route test — must never share
 * one. Wall-clock time wins whenever it is already ahead.
 */
export function nextStamp(): string {
  last = Math.max(Date.now(), last + 1);
  return new Date(last).toISOString();
}

/**
 * A stamp later than every one of `previous` as well, for a row another
 * instance may have written with a clock of its own. Name both
 * updated_at and published_at for a row's own stamp: approving and rolling
 * back leave published_at ahead of updated_at, and a later write that
 * landed on it exactly would read as published. Call it while holding the
 * row's lock, so nothing can write a later stamp in between.
 */
export function stampAfter(...previous: (string | null)[]): string {
  for (const stamp of previous) {
    const at = stamp ? parseStamp(stamp) : Number.NaN;
    if (Number.isFinite(at)) last = Math.max(last, at);
  }
  return nextStamp();
}

/** ISO, or SQLite's `YYYY-MM-DD HH:MM:SS` in UTC on rows it wrote, which
 *  Date.parse would otherwise read as local time. */
function parseStamp(value: string): number {
  return Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
}
