import { formatUsd, monthlyUsd, PRICES_USD } from '@temply/shared/plans';

export const MIN_SEATS = 1;
// A limit of the control, not a plan rule: the plans have no seat cap. Past
// this the sum is a conversation, and the Enterprise card beside it is the way
// to have one.
export const MAX_SEATS = 99;
// A small team, so the first thing the arithmetic shows is that the figure
// follows the head count.
export const START_SEATS = 3;

export function stepSeats(seats: number, by: number): number {
  return Math.min(MAX_SEATS, Math.max(MIN_SEATS, seats + by));
}

/**
 * The words around a seat count, drawn from the same plan rules the API bills
 * with so the page has no second price to keep in step. `users` is the count
 * alone, `product` the count times the seat price, and `total` the monthly sum
 * with its period. Each is one string, so a server render emits each as a
 * single text node.
 */
export function seatSum(seats: number) {
  const users = `${seats} ${seats === 1 ? 'user' : 'users'}`;
  return {
    users,
    product: `${users} × ${formatUsd(PRICES_USD.seat)}`,
    total: `${formatUsd(monthlyUsd(seats, 0))} a month`,
  };
}
