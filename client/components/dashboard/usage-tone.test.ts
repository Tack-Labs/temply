import { describe, expect, it } from 'bun:test';
import { TONE_FILL, TONE_NOTE, usagePct, usageTone } from './usage-tone';

// A test file is run by `bun test` and imported by nothing. No other test
// covers usageTone: the two cards were only checked through their markup.

const tone = (used: number, scale: number | null, capped = false, over = false) =>
  usageTone({ used, scale, capped, over });

describe('usageTone', () => {
  it('is accent while there is room', () => {
    expect(tone(0, 10_000)).toBe('accent');
    expect(tone(4_200, 10_000)).toBe('accent');
  });

  it('turns warn at 80% and not a count before', () => {
    expect(tone(7_999, 10_000)).toBe('accent');
    expect(tone(8_000, 10_000)).toBe('warn');
    expect(tone(9_999, 10_000)).toBe('warn');
  });

  it('reads the same floored percentage the bar does, never a rounded one', () => {
    // 79.6% is 79 on the bar's own arithmetic; rounding it to 80 is what once
    // put the home's tile in warn while the sidebar's card was not.
    expect(usagePct(7_960, 10_000)).toBe(79);
    expect(tone(7_960, 10_000)).toBe('accent');
  });

  it('is danger once a limit that blocks has been reached', () => {
    expect(tone(10_000, 10_000, true)).toBe('danger');
  });

  it('puts a block ahead of billed overage', () => {
    expect(tone(10_000, 10_000, true, true)).toBe('danger');
  });

  it('keeps warn for billed overage at any fill, since the plan carries on rather than stops', () => {
    expect(tone(11_200, 10_000, false, true)).toBe('warn');
    expect(tone(10, 10_000, false, true)).toBe('warn');
  });

  it('has nothing to measure against without a scale, and stays accent', () => {
    expect(tone(4_200, null)).toBe('accent');
    expect(tone(4_200, 0)).toBe('accent');
  });
});

describe('the tone classes', () => {
  it('are on the -ink tokens, one of each for the three tones', () => {
    expect(TONE_FILL).toEqual({ accent: 'bg-accent-ink', warn: 'bg-warn-ink', danger: 'bg-danger-ink' });
    expect(TONE_NOTE).toEqual({ accent: 'text-muted', warn: 'text-warn-ink', danger: 'text-danger-ink' });
  });
});
