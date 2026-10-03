import { describe, expect, it } from 'bun:test';
import { editedOn } from './locale-date';

describe('editedOn', () => {
  it('reads a timestamp as a day with its year', () => {
    expect(editedOn('2026-10-01T09:00:00.000Z')).toContain('2026');
  });

  it('says nothing for a missing or unreadable date rather than "Invalid Date"', () => {
    expect(editedOn(null)).toBeNull();
    expect(editedOn('')).toBeNull();
    expect(editedOn('not a date')).toBeNull();
  });
});
