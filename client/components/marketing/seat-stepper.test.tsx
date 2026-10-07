import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { formatUsd, monthlyUsd } from '@temply/shared/plans';
import { MAX_SEATS, START_SEATS } from './seat-sum';
import { SeatStepper } from './seat-stepper';

afterEach(cleanup);

const open = () => {
  const view = render(<SeatStepper />);
  const group = view.getByRole('group', { name: 'Users' });
  return {
    view,
    group,
    more: view.getByRole('button', { name: 'Increase seats' }),
    fewer: view.getByRole('button', { name: 'Decrease seats' }),
    total: view.container.querySelector('[aria-live="polite"]')!,
  };
};

describe('SeatStepper', () => {
  it('starts at the starting count, in the group and in the live total', () => {
    const { group, total } = open();
    expect(group.textContent).toBe(`${START_SEATS} users`);
    expect(total.textContent).toContain(`${START_SEATS} users × `);
    expect(total.textContent).toContain(`${formatUsd(monthlyUsd(START_SEATS, 0))} a month`);
    expect(total.getAttribute('aria-atomic')).toBe('true');
  });

  it('steps the count and the total together', () => {
    const { group, total, more, fewer } = open();
    fireEvent.click(more);
    expect(group.textContent).toBe(`${START_SEATS + 1} users`);
    expect(total.textContent).toContain(`${formatUsd(monthlyUsd(START_SEATS + 1, 0))} a month`);
    fireEvent.click(fewer);
    expect(group.textContent).toBe(`${START_SEATS} users`);
  });

  it('marks the minus aria-disabled at one user and ignores a press there', () => {
    const { group, fewer, more } = open();
    for (let n = 0; n < START_SEATS + 2; n++) fireEvent.click(fewer);
    expect(group.textContent).toBe('1 user');
    expect(fewer.getAttribute('aria-disabled')).toBe('true');
    expect(more.getAttribute('aria-disabled')).not.toBe('true');
    // aria-disabled, never `disabled`: the button keeps the keyboard.
    expect(fewer.hasAttribute('disabled')).toBe(false);
  });

  it('marks the plus aria-disabled at the cap and ignores a press there', () => {
    const { group, fewer, more } = open();
    for (let n = 0; n < MAX_SEATS + 2; n++) fireEvent.click(more);
    expect(group.textContent).toBe(`${MAX_SEATS} users`);
    expect(more.getAttribute('aria-disabled')).toBe('true');
    expect(fewer.getAttribute('aria-disabled')).not.toBe('true');
    expect(more.hasAttribute('disabled')).toBe(false);
  });
});
