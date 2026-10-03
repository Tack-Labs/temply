'use client';
import { useSyncExternalStore } from 'react';

/** The local calendar day as yyyymmdd: it changes at midnight and at no other moment. */
export function localDay(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** Milliseconds from `now` to the next local midnight. Built from the calendar
 *  date, not by adding 24 hours, so a daylight-saving change does not skew it. */
export function msUntilNextMidnight(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    // A second past midnight, so a timer that fires early by a rounding still
    // lands on the new day.
    timer = setTimeout(() => {
      onChange();
      arm();
    }, msUntilNextMidnight(new Date()) + 1000);
  };
  arm();
  // A background tab's timers are throttled and a slept laptop's are late;
  // coming back to the tab re-reads the day rather than waiting for them.
  document.addEventListener('visibilitychange', onChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onChange);
  };
}

/**
 * The reader's current day, or null on the server and during hydration. A
 * time shown relative to "today" needs the reader's clock and zone, which the
 * server cannot know; null is the server's and the first client render's
 * answer, so the markup agrees, and the day arrives with the render after it.
 * The value then changes once a day, so a tab left open past midnight
 * re-renders and re-words what it showed.
 */
export function useToday(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => localDay(new Date()),
    () => null,
  );
}
