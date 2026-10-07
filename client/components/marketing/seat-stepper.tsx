'use client';

import { useState } from 'react';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { ariaDisabled, Button } from '~/components/ui/button';
import { cn } from '~/lib/classname';
import { MAX_SEATS, MIN_SEATS, seatSum, START_SEATS, stepSeats } from './seat-sum';

// aria-disabled, not disabled: pressing the button that reaches a bound would
// otherwise disable the very element holding the keyboard, and focus would
// fall back to the top of the page. The step clamps, so a press at a bound
// does nothing, and the look is Button's disabled one (a filled pill in the
// disabled ink) without the focus loss.
const BOUND = `aria-disabled:cursor-not-allowed ${ariaDisabled}`;

/**
 * Seats times the per-seat price, as a sentence with the two buttons that
 * change the count. It is an illustration of the sum, not a quote: the real
 * count is the members of the organisation, read at subscription time. Without
 * script it stays as the three-seat sum.
 *
 * The sentence is the one live region, so a change is read out once, with the
 * count that produced it. The group carries the count too, hidden from the
 * eye because the sentence beside it already shows it, so a screen reader
 * moving through the buttons hears where it stands.
 */
export function SeatStepper() {
  const [seats, setSeats] = useState(START_SEATS);
  const { users, product, total } = seatSum(seats);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-sunken py-3 pr-3.5 pl-5">
      <p aria-live="polite" aria-atomic="true" className="min-w-0 text-lg font-semibold text-ink tabular-nums">
        {product} <span className="font-medium whitespace-nowrap text-muted">= {total}</span>
      </p>
      <div role="group" aria-label="Users" className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Decrease seats"
          aria-disabled={seats <= MIN_SEATS}
          className={cn('size-11', BOUND)}
          onClick={() => setSeats((n) => stepSeats(n, -1))}
        >
          <MinusIcon aria-hidden />
        </Button>
        <span className="sr-only">{users}</span>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Increase seats"
          aria-disabled={seats >= MAX_SEATS}
          className={cn('size-11', BOUND)}
          onClick={() => setSeats((n) => stepSeats(n, 1))}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
    </div>
  );
}
