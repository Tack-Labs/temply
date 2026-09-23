import { describe, expect, it } from 'bun:test';
import { formatBytes } from './bytes';

describe('formatBytes', () => {
  it('picks the unit that keeps the number readable', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(3 * 1024)).toBe('3 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('drops a trailing .0 but keeps one decimal under 10', () => {
    expect(formatBytes(9.96 * 1024 * 1024)).toBe('10 MB');
    expect(formatBytes(12.34 * 1024 * 1024)).toBe('12 MB');
  });
});
