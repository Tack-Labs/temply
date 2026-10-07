import { describe, expect, it } from 'bun:test';
import { parseStamp } from './stamp';

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

const zones = ['UTC', 'America/Los_Angeles', 'Pacific/Auckland'];

describe('parseStamp', () => {
  // The API sends `YYYY-MM-DD HH:MM:SS` in UTC with no zone on it, and `new
  // Date` reads a zone-less string as the reader's local time.
  it('reads a stamp in the database shape as UTC, whatever zone the reader is in', () => {
    for (const zone of zones) {
      expect(inZone(zone, () => parseStamp('2026-10-06 10:00:00').toISOString()), zone).toBe('2026-10-06T10:00:00.000Z');
    }
  });

  it('reads the same stamp with a T, and with fractional seconds, the same way', () => {
    for (const zone of zones) {
      expect(inZone(zone, () => parseStamp('2026-10-06T10:00:00').toISOString()), zone).toBe('2026-10-06T10:00:00.000Z');
      expect(inZone(zone, () => parseStamp('2026-10-06 09:59:59.750').toISOString()), zone).toBe('2026-10-06T09:59:59.750Z');
    }
  });

  it('leaves a stamp that names its own zone to Date', () => {
    for (const zone of zones) {
      expect(inZone(zone, () => parseStamp('2026-10-06T10:00:00Z').toISOString()), zone).toBe('2026-10-06T10:00:00.000Z');
      expect(inZone(zone, () => parseStamp('2026-10-06T12:00:00+02:00').toISOString()), zone).toBe('2026-10-06T10:00:00.000Z');
      expect(inZone(zone, () => parseStamp('2026-10-06T10:00:00.250Z').toISOString()), zone).toBe('2026-10-06T10:00:00.250Z');
    }
  });

  it('tolerates the whitespace a stored value can carry', () => {
    expect(parseStamp(' 2026-10-06 10:00:00 ').toISOString()).toBe('2026-10-06T10:00:00.000Z');
  });

  it('gives an invalid date, not a throw, for text that is no stamp', () => {
    expect(Number.isNaN(parseStamp('not a date').getTime())).toBe(true);
    expect(Number.isNaN(parseStamp('').getTime())).toBe(true);
  });
});
