import { describe, expect, it } from 'bun:test';
import { formatUsd, monthlyUsd, PRICES_USD } from '@temply/shared/plans';
import { MAX_SEATS, MIN_SEATS, seatSum, START_SEATS, stepSeats } from './seat-sum';

describe('stepSeats', () => {
  it('moves by the step', () => {
    expect(stepSeats(3, 1)).toBe(4);
    expect(stepSeats(3, -1)).toBe(2);
  });

  it('holds at the bounds instead of passing them', () => {
    expect(stepSeats(MIN_SEATS, -1)).toBe(MIN_SEATS);
    expect(stepSeats(MAX_SEATS, 1)).toBe(MAX_SEATS);
    expect(stepSeats(MAX_SEATS - 1, 1)).toBe(MAX_SEATS);
    expect(stepSeats(MIN_SEATS + 1, -1)).toBe(MIN_SEATS);
  });

  it('starts inside them', () => {
    expect(START_SEATS).toBeGreaterThanOrEqual(MIN_SEATS);
    expect(START_SEATS).toBeLessThanOrEqual(MAX_SEATS);
  });
});

describe('seatSum', () => {
  it('words the count, the product and the total from the plan rules', () => {
    expect(seatSum(3)).toEqual({
      users: '3 users',
      product: `3 users × ${formatUsd(PRICES_USD.seat)}`,
      total: `${formatUsd(monthlyUsd(3, 0))} a month`,
    });
  });

  it('says "1 user", not "1 users"', () => {
    expect(seatSum(1).users).toBe('1 user');
    expect(seatSum(1).product.startsWith('1 user ×')).toBe(true);
  });

  // A price typed into the helper survives the next plan change; moving the
  // seat price for the call and putting it back is the only way to tell a
  // figure read from one typed.
  it('follows the seat price', () => {
    const prices = PRICES_USD as { -readonly [K in keyof typeof PRICES_USD]: number };
    const seat = prices.seat;
    prices.seat = 7;
    try {
      expect(seatSum(3)).toEqual({ users: '3 users', product: '3 users × $7', total: '$21 a month' });
    } finally {
      prices.seat = seat;
    }
  });
});
