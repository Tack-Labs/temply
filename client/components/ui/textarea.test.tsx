import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { Textarea } from './textarea';

// Queries come off `render`, not the global `screen`; see button.test.tsx.
afterEach(cleanup);

describe('Textarea', () => {
  it('wears the one-line field\'s tokens on a taller box that can be pulled taller', () => {
    const classes = render(<Textarea aria-label="Message" />).getByRole('textbox', { name: 'Message' }).className.split(/\s+/);
    for (const needed of ['rounded-field', 'border-[1.5px]', 'border-line-strong', 'bg-raised', 'text-lg', 'px-4', 'w-full', 'min-h-32', 'resize-y', 'focus-visible:border-accent']) {
      expect(classes).toContain(needed);
    }
    expect(classes, 'a text box is not a 48px line').not.toContain('h-12');
  });

  it('is disabled as a filled field in the disabled ink, not the live one at half strength', () => {
    const classes = render(<Textarea aria-label="Locked" disabled />).getByRole('textbox', { name: 'Locked' }).className.split(/\s+/);
    for (const needed of ['disabled:bg-track', 'disabled:text-disabled', 'disabled:border-transparent', 'disabled:cursor-not-allowed']) {
      expect(classes).toContain(needed);
    }
    expect(classes.some((name) => name.startsWith('disabled:opacity'))).toBe(false);
  });

  it('passes its ref, rows and attributes through and lets a call site pin another height', () => {
    const view = render(<Textarea aria-label="Note" rows={3} maxLength={500} className="min-h-24" />);
    const box = view.getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement;
    expect(box.getAttribute('rows')).toBe('3');
    expect(box.getAttribute('maxlength')).toBe('500');
    expect(box.className.split(/\s+/)).toContain('min-h-24');
    expect(box.className.split(/\s+/)).not.toContain('min-h-32');
  });
});
