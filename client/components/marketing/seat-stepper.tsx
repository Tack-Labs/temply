'use client';

import { useState } from 'react';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { formatUsd, monthlyUsd, PRICES_USD } from '@temply/shared/plans';
import { Button } from '~/components/ui/button';

const MIN_SEATS = 1;
// A limit of this control, not a plan rule: the plans have no seat cap. Past
// this the sum is a conversation, and the Enterprise card beside it is the way
// to have one.
const MAX_SEATS = 99;
// A small team, so the first thing the arithmetic shows is that the figure
// follows the head count.
const START_SEATS = 3;

// aria-disabled, not disabled: pressing the button that reaches a bound would
// otherwise disable the very element holding the keyboard, and focus would
// fall back to the top of the page. The step clamps, so a press at a bound
// does nothing, and the look is the disabled one without the focus loss.
const BOUND =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:hover:border-line aria-disabled:hover:bg-raised aria-disabled:active:scale-100';

/**
 * Seats times the per-seat price, drawn from the same plan rules the API bills
 * with so the page has no second price to keep in step. It is an illustration
 * of the sum, not a quote: the real count is the members of the organisation,
 * read at subscription time. Without script it stays as the three-seat sum.
 */
export function SeatStepper() {
  const [seats, setSeats] = useState(START_SEATS);
  const step = (by: number) => setSeats((n) => Math.min(MAX_SEATS, Math.max(MIN_SEATS, n + by)));

  return (
    <div className="mt-5 flex flex-col items-start gap-4 rounded-xl border border-line bg-sunken p-4">
      <div role="group" aria-label="Users" className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Decrease seats"
          aria-disabled={seats <= MIN_SEATS}
          className={BOUND}
          onClick={() => step(-1)}
        >
          <MinusIcon aria-hidden />
        </Button>
        <span className="min-w-16 text-center text-base font-semibold text-ink tabular-nums">
          {seats} {seats === 1 ? 'user' : 'users'}
        </span>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Increase seats"
          aria-disabled={seats >= MAX_SEATS}
          className={BOUND}
          onClick={() => step(1)}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>

      {/* One live region for the sum, so a change is read out once, with the
          count that produced it. */}
      <p aria-live="polite" aria-atomic="true">
        <span className="block text-xs text-muted tabular-nums">
          {seats} {seats === 1 ? 'user' : 'users'} × {formatUsd(PRICES_USD.seat)}
        </span>
        <span className="font-display text-2xl font-semibold tracking-display text-ink tabular-nums">
          {formatUsd(monthlyUsd(seats, 0))}
        </span>{' '}
        <span className="text-sm text-muted">a month</span>
      </p>
    </div>
  );
}
