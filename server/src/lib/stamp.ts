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
