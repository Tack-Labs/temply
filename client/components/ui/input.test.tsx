import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { Input } from './input';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

describe('Input', () => {
  it('is a 48px field on the field radius, with a 1.5px border you can see, 16px text and 16px of padding', () => {
    const classes = render(<Input aria-label="Name" />).getByRole('textbox', { name: 'Name' }).className.split(/\s+/);
    for (const needed of ['h-12', 'rounded-field', 'border-[1.5px]', 'border-line-strong', 'bg-raised', 'text-lg', 'px-4', 'w-full']) {
      expect(classes).toContain(needed);
    }
    expect(classes, 'the old hairline would sit under the new border').not.toContain('border');
    expect(classes, 'a field stays off the pill radius a button wears').not.toContain('rounded-full');
    // 16px is also what keeps iOS Safari from zooming the page on focus.
    expect(classes).not.toContain('text-ui');
  });

  it('turns its border to the accent on focus, because the base layer\'s own rule loses to the border utility', () => {
    const classes = render(<Input aria-label="Name" />).getByRole('textbox', { name: 'Name' }).className.split(/\s+/);
    expect(classes).toContain('focus-visible:border-accent');
  });

  it('lets a call site pin another height or radius instead of fighting the default', () => {
    const classes = render(<Input aria-label="Dense" className="h-9 rounded-md" />).getByRole('textbox', { name: 'Dense' }).className.split(/\s+/);
    expect(classes).toContain('h-9');
    expect(classes).not.toContain('h-12');
    expect(classes).toContain('rounded-md');
    expect(classes).not.toContain('rounded-field');
  });

  it('passes its type, ref and attributes through', () => {
    const view = render(<Input aria-label="Email" type="email" placeholder="you@company.com" disabled />);
    const input = view.getByRole('textbox', { name: 'Email' }) as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.disabled).toBe(true);
    expect(input.className).toContain('placeholder:text-muted');
  });

  it('is disabled as a filled field in the disabled ink, not the live one at half strength', () => {
    const classes = render(<Input aria-label="Locked" disabled />).getByRole('textbox', { name: 'Locked' }).className.split(/\s+/);
    for (const needed of ['disabled:bg-track', 'disabled:text-disabled', 'disabled:border-transparent', 'disabled:cursor-not-allowed']) {
      expect(classes).toContain(needed);
    }
    expect(classes.some((name) => name.startsWith('disabled:opacity'))).toBe(false);
  });
});
