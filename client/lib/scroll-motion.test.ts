import { describe, expect, it } from 'bun:test';
import { clampedParallax } from './scroll-motion';

describe('clampedParallax', () => {
  it('scales scroll by speed', () => {
    expect(clampedParallax(100, 0.2, 40)).toBe(20);
  });
  it('clamps to the max magnitude', () => {
    expect(clampedParallax(1000, 0.2, 40)).toBe(40);
  });
  it('is symmetric for negative scroll', () => {
    expect(clampedParallax(-1000, 0.2, 40)).toBe(-40);
  });
  it('is zero at the top', () => {
    expect(clampedParallax(0, 0.5, 40)).toBe(0);
  });
});
