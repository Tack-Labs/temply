import { describe, expect, it } from 'bun:test';
import { exactTime, relativeTime } from './relative-time';

const now = new Date('2026-10-06T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it('says just now for the first minute, and for a stamp slightly ahead of this clock', () => {
    expect(relativeTime(ago(5 * SECOND), now)).toBe('just now');
    expect(relativeTime(ago(59 * SECOND), now)).toBe('just now');
    // Two machines never agree to the second; a save a moment in the future is not "in 3 seconds".
    expect(relativeTime(ago(-30 * SECOND), now)).toBe('just now');
  });

  it('counts minutes, then hours', () => {
    expect(relativeTime(ago(MINUTE), now)).toBe('1 minute ago');
    expect(relativeTime(ago(45 * MINUTE), now)).toBe('45 minutes ago');
    expect(relativeTime(ago(HOUR), now)).toBe('1 hour ago');
    expect(relativeTime(ago(2 * HOUR + 40 * MINUTE), now)).toBe('2 hours ago');
    expect(relativeTime(ago(23 * HOUR), now)).toBe('23 hours ago');
  });

  it('counts days up to a week, and says "1 day ago" rather than "yesterday"', () => {
    // Elapsed time is not calendar days: 40 hours back can be the day before
    // yesterday, and "yesterday" would be wrong for it.
    expect(relativeTime(ago(DAY), now)).toBe('1 day ago');
    expect(relativeTime(ago(40 * HOUR), now)).toBe('1 day ago');
    expect(relativeTime(ago(3 * DAY), now)).toBe('3 days ago');
    expect(relativeTime(ago(6 * DAY + 23 * HOUR), now)).toBe('6 days ago');
  });

  it('counts weeks, and says "1 week ago" rather than "last week"', () => {
    expect(relativeTime(ago(7 * DAY), now)).toBe('1 week ago');
    expect(relativeTime(ago(13 * DAY), now)).toBe('1 week ago');
    expect(relativeTime(ago(14 * DAY), now)).toBe('2 weeks ago');
    expect(relativeTime(ago(27 * DAY), now)).toBe('3 weeks ago');
  });

  it('counts months, then years', () => {
    expect(relativeTime(ago(31 * DAY), now)).toBe('1 month ago');
    expect(relativeTime(ago(100 * DAY), now)).toBe('3 months ago');
    expect(relativeTime(ago(364 * DAY), now)).toBe('11 months ago');
    expect(relativeTime(ago(366 * DAY), now)).toBe('1 year ago');
    expect(relativeTime(ago(800 * DAY), now)).toBe('2 years ago');
  });

  it('is English whatever the browser speaks, since the words around it are', () => {
    expect(relativeTime(ago(3 * DAY), now)).toBe('3 days ago');
  });

  it('gives nothing for a stamp that is missing or will not parse', () => {
    expect(relativeTime(null, now)).toBeNull();
    expect(relativeTime('', now)).toBeNull();
    expect(relativeTime('not a date', now)).toBeNull();
  });
});

/** The reader's zone for the length of `run`, then whatever it was. */
function inZone<T>(timeZone: string, run: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

describe('a stamp in the database shape', () => {
  // The API sends `YYYY-MM-DD HH:MM:SS` in UTC with no zone on it, and
  // `new Date` reads a zone-less string as the reader's local time: in Los
  // Angeles "10:00" came out seven hours in the future and read "just now".
  const zones = ['UTC', 'America/Los_Angeles', 'Pacific/Auckland'];

  it('is read as UTC, so the same stamp is the same distance in every zone', () => {
    for (const zone of zones) {
      expect(inZone(zone, () => relativeTime('2026-10-06 10:00:00', now)), zone).toBe('2 hours ago');
      expect(inZone(zone, () => relativeTime('2026-10-06 11:59:30', now)), zone).toBe('just now');
      expect(inZone(zone, () => relativeTime('2026-10-04 12:00:00', now)), zone).toBe('2 days ago');
    }
  });

  it('reads fractional seconds the same way', () => {
    for (const zone of zones) {
      expect(inZone(zone, () => relativeTime('2026-10-06 09:59:59.750', now)), zone).toBe('2 hours ago');
    }
  });

  it('leaves a stamp that names its own zone alone', () => {
    for (const zone of zones) {
      expect(inZone(zone, () => relativeTime('2026-10-06T10:00:00Z', now)), zone).toBe('2 hours ago');
      expect(inZone(zone, () => relativeTime('2026-10-06T12:00:00+02:00', now)), zone).toBe('2 hours ago');
    }
  });

  it('gives the same exact time in every zone it is asked for', () => {
    for (const zone of zones) {
      expect(inZone(zone, () => exactTime('2026-10-01 09:30:00', { locale: 'en-GB', timeZone: 'UTC' })), zone).toContain('09:30');
    }
  });
});

describe('exactTime', () => {
  it('writes the whole date and time, for the tooltip a relative phrase needs', () => {
    const text = exactTime('2026-10-01T09:30:00.000Z', { locale: 'en-GB', timeZone: 'UTC' });
    expect(text).toContain('1 Oct 2026');
    expect(text).toContain('09:30');
  });

  it('gives nothing for a stamp that is missing or will not parse', () => {
    expect(exactTime(null)).toBeNull();
    expect(exactTime('not a date')).toBeNull();
  });
});
