import { describe, expect, test } from 'bun:test';
import { cn } from './classname';

// tailwind-merge only knows Tailwind's own theme keys, so a custom font size or
// radius name has to be declared to it or it merges them as something else.
describe('cn with the design tokens', () => {
  test('keeps text-ui beside a text colour instead of reading it as a colour', () => {
    expect(cn('text-ui', 'text-muted')).toBe('text-ui text-muted');
  });

  test('lets text-ui replace another font size, and be replaced by one', () => {
    expect(cn('text-sm', 'text-ui')).toBe('text-ui');
    expect(cn('text-ui', 'text-xs')).toBe('text-xs');
  });

  // The six sizes the redesign's type scale adds are named for their pixels.
  // Left undeclared, `text-34` would be read as a colour: it would sit beside a
  // size instead of replacing it, and `text-muted` would delete it.
  test('reads the pixel-named sizes as font sizes, not colours', () => {
    for (const step of ['18', '26', '34', '38', '48', '68']) {
      expect(cn(`text-${step}`, 'text-muted')).toBe(`text-${step} text-muted`);
      expect(cn('text-ink-soft', `text-${step}`)).toBe(`text-ink-soft text-${step}`);
      expect(cn('text-sm', `text-${step}`)).toBe(`text-${step}`);
      expect(cn(`text-${step}`, 'text-xs')).toBe('text-xs');
    }
    expect(cn('text-18', 'text-26')).toBe('text-26');
    expect(cn('text-ui', 'text-34', 'text-4xl')).toBe('text-4xl');
  });

  test('keeps the new colour tokens as colours that replace one another', () => {
    expect(cn('text-muted', 'text-ink-soft')).toBe('text-ink-soft');
    expect(cn('bg-sunken', 'bg-track')).toBe('bg-track');
    expect(cn('border-line', 'border-accent-edge')).toBe('border-accent-edge');
    expect(cn('outline-accent-ink', 'outline-focus')).toBe('outline-focus');
  });

  test('lets a custom radius replace a stock one, and be replaced by one', () => {
    expect(cn('rounded-md', 'rounded-card')).toBe('rounded-card');
    expect(cn('rounded-field', 'rounded-full')).toBe('rounded-full');
    expect(cn('rounded-card', 'rounded-panel')).toBe('rounded-panel');
  });

  test('lets the cta shadow replace a ladder shadow instead of sitting beside it as a shadow colour', () => {
    expect(cn('shadow-sm', 'shadow-cta')).toBe('shadow-cta');
    expect(cn('shadow-cta', 'shadow-none')).toBe('shadow-none');
    expect(cn('shadow-cta', 'shadow-accent')).toBe('shadow-cta shadow-accent');
  });

  test('still merges ordinary conflicts', () => {
    expect(cn('px-3', 'px-4')).toBe('px-4');
    expect(cn('h-8', false && 'h-9', 'pointer-coarse:h-11')).toBe('h-8 pointer-coarse:h-11');
  });
});
