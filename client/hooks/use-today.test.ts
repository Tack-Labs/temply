import { describe, expect, it } from 'bun:test';
import { localDay, msUntilNextMidnight } from './use-today';

// Built from local calendar parts, so the cases mean the same in every zone
// the suite runs in.
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);

describe('localDay', () => {
  it('is the calendar date as one number', () => {
    expect(localDay(at(2026, 10, 3, 15))).toBe(20261003);
  });

  it('holds from the first second of a day to the last, and turns at midnight', () => {
    expect(localDay(at(2026, 10, 3, 0, 0, 0))).toBe(localDay(at(2026, 10, 3, 23, 59, 59)));
    expect(localDay(at(2026, 10, 3, 23, 59, 59))).not.toBe(localDay(at(2026, 10, 4, 0, 0, 0)));
  });

  it('rolls over a month and a year', () => {
    expect(localDay(at(2026, 9, 30, 23, 59))).toBe(20260930);
    expect(localDay(at(2026, 10, 1, 0, 1))).toBe(20261001);
    expect(localDay(at(2026, 12, 31, 23, 59))).toBe(20261231);
    expect(localDay(at(2027, 1, 1, 0, 1))).toBe(20270101);
  });
});

describe('msUntilNextMidnight', () => {
  it('counts to the next local midnight', () => {
    expect(msUntilNextMidnight(at(2026, 10, 3, 23, 0, 0))).toBe(60 * 60 * 1000);
    expect(msUntilNextMidnight(at(2026, 10, 3, 23, 59, 59))).toBe(1000);
  });

  it('is a full day from midnight itself, never zero', () => {
    // Zero would re-arm the timer in a tight loop the instant it fired.
    expect(msUntilNextMidnight(at(2026, 10, 3, 0, 0, 0))).toBeGreaterThan(0);
  });

  it('lands on the day after, across a month end', () => {
    const now = at(2026, 9, 30, 12);
    const next = new Date(now.getTime() + msUntilNextMidnight(now));
    expect(localDay(next)).toBe(20261001);
  });
});
