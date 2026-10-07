import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { ariaDisabled, Button, pressable } from './button';

// Queries come off `render`, not the global `screen`: Testing Library binds
// `screen` to the document it finds when it loads, and Bun runs every test
// file in one process, where the document is happy-dom's and arrives with
// the first file that asks for it.
afterEach(cleanup);

describe('Button', () => {
  it('never submits a form by accident: a bare button is type=button', () => {
    const plain = render(<Button>Save</Button>);
    expect(plain.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
    cleanup();
    const submit = render(<Button type="submit">Send</Button>);
    expect(submit.getByRole('button', { name: 'Send' }).getAttribute('type')).toBe('submit');
  });

  it('is secondary and medium unless told otherwise, and each variant is its own tokens', () => {
    const view = render(
      <>
        <Button>Plain</Button>
        <Button variant="primary" size="sm">Go</Button>
        <Button variant="danger">Delete</Button>
      </>,
    );
    expect(view.getByRole('button', { name: 'Plain' }).className).toContain('bg-raised');
    expect(view.getByRole('button', { name: 'Go' }).className).toContain('bg-accent');
    expect(view.getByRole('button', { name: 'Go' }).className).toContain('h-7');
    expect(view.getByRole('button', { name: 'Delete' }).className).toContain('bg-danger');
  });

  it('is a pill in every variant and size, so a button never reads as a rectangle', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'danger-quiet', 'link'] as const;
    const sizes = ['sm', 'compact', 'md', 'lg', 'icon', 'icon-sm'] as const;
    for (const variant of variants) {
      for (const size of sizes) {
        const label = `${variant} ${size}`;
        const classes = render(<Button variant={variant} size={size}>{label}</Button>).getByRole('button', { name: label }).className.split(/\s+/);
        expect(classes, label).toContain('rounded-full');
        cleanup();
      }
    }
  });

  it('keeps the text size beside the variant\'s own colour instead of letting one drop the other', () => {
    const ghost = render(<Button variant="ghost">Quiet</Button>).getByRole('button', { name: 'Quiet' }).className.split(/\s+/);
    expect(ghost).toContain('text-lg');
    expect(ghost).toContain('text-ink-soft');
    cleanup();
    const primary = render(<Button variant="primary">Go</Button>).getByRole('button', { name: 'Go' }).className.split(/\s+/);
    expect(primary).toContain('text-lg');
    expect(primary).toContain('text-white');
  });

  it('draws the secondary with a 1.5px strong border on the raised fill, and washes it on hover instead of darkening the border', () => {
    const classes = render(<Button>Send a test</Button>).getByRole('button', { name: 'Send a test' }).className.split(/\s+/);
    for (const needed of ['border-[1.5px]', 'border-line-strong', 'bg-raised', 'text-ink', 'hover:bg-hover']) {
      expect(classes).toContain(needed);
    }
    expect(classes, 'the old hairline would sit under the new border').not.toContain('border');
    expect(classes.some((name) => name.startsWith('hover:border-'))).toBe(false);
  });

  it('keeps the ghost a step quieter than ink, and lets it fill on hover', () => {
    const classes = render(<Button variant="ghost">History</Button>).getByRole('button', { name: 'History' }).className.split(/\s+/);
    expect(classes).toContain('text-ink-soft');
    expect(classes).toContain('hover:bg-hover');
    expect(classes).not.toContain('text-muted');
  });

  it('has a solid danger and a text-only one, the second with no resting fill and a wash on hover', () => {
    const view = render(
      <>
        <Button variant="danger">Solid</Button>
        <Button variant="danger-quiet">Quiet</Button>
      </>,
    );
    const quiet = view.getByRole('button', { name: 'Quiet' }).className.split(/\s+/);
    expect(quiet).not.toContain('bg-danger-wash');
    expect(quiet).toContain('hover:bg-danger-wash');
    const solid = view.getByRole('button', { name: 'Solid' }).className.split(/\s+/);
    expect(solid).toContain('bg-danger');
    expect(solid).toContain('text-white');
  });

  it('gives the primary call to action its violet glow at page size, and a plain shadow where it is dense', () => {
    const view = render(
      <>
        <Button variant="primary">Page</Button>
        <Button variant="primary" size="lg">Hero</Button>
        <Button variant="primary" size="compact">Toolbar</Button>
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="secondary">Other</Button>
      </>,
    );
    expect(view.getByRole('button', { name: 'Page' }).className.split(/\s+/)).toContain('shadow-cta');
    expect(view.getByRole('button', { name: 'Page' }).className.split(/\s+/), 'the glow replaces the plain shadow').not.toContain('shadow-sm');
    expect(view.getByRole('button', { name: 'Hero' }).className).toContain('shadow-cta');
    for (const dense of ['Toolbar', 'Small']) {
      const classes = view.getByRole('button', { name: dense }).className;
      expect(classes).not.toContain('shadow-cta');
      expect(classes).toContain('shadow-sm');
    }
    expect(view.getByRole('button', { name: 'Other' }).className).not.toContain('shadow-cta');
  });

  it('drops its shadow when disabled, so a button that cannot be pressed does not glow', () => {
    expect(render(<Button disabled>Wait</Button>).getByRole('button', { name: 'Wait' }).className).toContain('disabled:shadow-none');
  });

  it('is disabled as a filled pill on the track in the disabled ink, not as the same button at half strength', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'danger-quiet'] as const) {
      const classes = render(<Button variant={variant} disabled>{variant}</Button>).getByRole('button', { name: variant }).className.split(/\s+/);
      expect(classes, variant).toContain('disabled:bg-track');
      expect(classes, variant).toContain('disabled:text-disabled');
      expect(classes, variant).toContain('disabled:shadow-none');
      expect(classes.some((name) => name.startsWith('disabled:opacity')), `${variant} fades instead of filling`).toBe(false);
      cleanup();
    }
  });

  it('keeps the secondary\'s border width when disabled, only clearing its colour, so the label does not move', () => {
    const classes = render(<Button disabled>Wait</Button>).getByRole('button', { name: 'Wait' }).className.split(/\s+/);
    expect(classes).toContain('border-[1.5px]');
    expect(classes).toContain('disabled:border-transparent');
  });

  it('leaves a link variant unfilled when disabled: it is text in a sentence, not a pill', () => {
    const classes = render(<Button variant="link" disabled>Terms</Button>).getByRole('button', { name: 'Terms' }).className.split(/\s+/);
    expect(classes).toContain('disabled:bg-transparent');
    expect(classes).toContain('disabled:text-disabled');
    expect(classes).not.toContain('disabled:bg-track');
  });

  it('as a child lends its look to a link without wrapping it in a button', () => {
    const view = render(
      <Button asChild variant="primary">
        <a href="/dashboard">Dashboard</a>
      </Button>,
    );
    const link = view.getByRole('link', { name: 'Dashboard' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('type')).toBeNull();
    expect(link.className).toContain('bg-accent');
    expect(view.queryByRole('button')).toBeNull();
  });

  it('disabled means disabled to the pointer and the reader alike', () => {
    const view = render(<Button disabled>Wait</Button>);
    const button = view.getByRole('button', { name: 'Wait' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toContain('disabled:pointer-events-none');
  });

  it('is 48px by default and 56px large, with no coarse-pointer step because both are already past the 44px floor', () => {
    const view = render(
      <>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
      </>,
    );
    const medium = view.getByRole('button', { name: 'Medium' }).className.split(/\s+/);
    expect(medium).toContain('h-12');
    expect(medium).toContain('px-6');
    expect(medium.some((name) => name.startsWith('pointer-coarse:h-'))).toBe(false);
    const large = view.getByRole('button', { name: 'Large' }).className.split(/\s+/);
    expect(large).toContain('h-14');
    expect(large.some((name) => name.startsWith('pointer-coarse:h-'))).toBe(false);
  });

  it('reads at 16px in semibold at page size, and stays medium weight where it is dense', () => {
    const view = render(
      <>
        <Button>Page</Button>
        <Button size="lg">Hero</Button>
        <Button size="compact">Toolbar</Button>
      </>,
    );
    for (const name of ['Page', 'Hero']) {
      const classes = view.getByRole('button', { name }).className.split(/\s+/);
      expect(classes, name).toContain('text-lg');
      expect(classes, name).toContain('font-semibold');
      expect(classes, name).not.toContain('font-medium');
    }
    expect(view.getByRole('button', { name: 'Toolbar' }).className.split(/\s+/)).toContain('font-medium');
  });

  it('keeps compact and icon at fine-pointer density and reaches 44px under a coarse pointer', () => {
    const view = render(
      <>
        <Button size="compact">Compact</Button>
        <Button size="icon" aria-label="Icon" />
      </>,
    );
    const compact = view.getByRole('button', { name: 'Compact' }).className;
    expect(compact).toContain('h-8');
    expect(compact).toContain('pointer-coarse:h-11');
    const icon = view.getByRole('button', { name: 'Icon' }).className;
    expect(icon).toContain('size-8');
    expect(icon).toContain('pointer-coarse:size-11');
  });

  it('keeps the small sizes dense on touch until a call site opts in', () => {
    const view = render(
      <>
        <Button size="sm">Dense</Button>
        <Button size="sm" touch>Grown</Button>
        <Button size="icon-sm" aria-label="Dense icon" />
        <Button size="icon-sm" touch aria-label="Grown icon" />
      </>,
    );
    expect(view.getByRole('button', { name: 'Dense' }).className).not.toContain('pointer-coarse');
    expect(view.getByRole('button', { name: 'Grown' }).className).toContain('pointer-coarse:h-11');
    expect(view.getByRole('button', { name: 'Dense icon' }).className).not.toContain('pointer-coarse');
    expect(view.getByRole('button', { name: 'Grown icon' }).className).toContain('pointer-coarse:size-11');
  });

  it('keeps touch off the DOM', () => {
    const view = render(<Button touch size="sm">Save</Button>);
    expect(view.getByRole('button', { name: 'Save' }).hasAttribute('touch')).toBe(false);
  });

  // The global :focus-visible rule in globals.css draws the same outline on
  // an <a> or <button>, so a browser test cannot tell whether these classes
  // are there. This is the one that fails when they are deleted.
  it('ariaDisabled is the disabled pill for a button that keeps the keyboard, never the live one at half strength', () => {
    const classes = ariaDisabled.split(/\s+/);
    for (const needed of ['aria-disabled:bg-track', 'aria-disabled:text-disabled', 'aria-disabled:border-transparent', 'aria-disabled:shadow-none', 'aria-disabled:hover:bg-track', 'aria-disabled:active:scale-100']) {
      expect(classes).toContain(needed);
    }
    expect(classes.some((name) => name.startsWith('aria-disabled:opacity'))).toBe(false);
  });

  it('pressable carries its own focus outline, a solid 3px ring in the focus token held 2px off the edge', () => {
    const own = pressable.split(/\s+/);
    for (const needed of ['focus-visible:outline-3', 'focus-visible:outline-offset-2', 'focus-visible:outline-focus']) {
      expect(own).toContain(needed);
    }
    expect(own, 'the retired 2px accent-ink ring').not.toContain('focus-visible:outline-2');
    expect(own).not.toContain('focus-visible:outline-accent-ink');
    expect(own).not.toContain('focus-visible:outline-none');
    expect(own.some((name) => name.startsWith('focus-visible:ring'))).toBe(false);
  });

  it('a Button wears pressable, outline included', () => {
    const classes = render(<Button>Focus</Button>).getByRole('button', { name: 'Focus' }).className.split(/\s+/);
    for (const name of pressable.split(/\s+/)) expect(classes).toContain(name);
  });

  it('a size pinned at a call site holds for a fine pointer only, unless it is pinned for touch as well', () => {
    const view = render(
      <>
        <Button size="icon" className="size-7" aria-label="Fine only" />
        <Button size="icon" className="size-7 pointer-coarse:size-7" aria-label="Pinned" />
      </>,
    );
    const fineOnly = view.getByRole('button', { name: 'Fine only' }).className.split(/\s+/);
    expect(fineOnly).toContain('size-7');
    expect(fineOnly).not.toContain('size-8');
    expect(fineOnly, 'tailwind-merge keeps the coarse size, so it still wins on touch').toContain('pointer-coarse:size-11');
    const pinned = view.getByRole('button', { name: 'Pinned' }).className.split(/\s+/);
    expect(pinned).toContain('pointer-coarse:size-7');
    expect(pinned).not.toContain('pointer-coarse:size-11');
  });

  it('settles the focus outline and the danger hover instead of snapping them', () => {
    expect(pressable).toContain('outline-color');
    expect(pressable).toContain('filter');
    expect(pressable).toContain('motion-reduce:transition-none');
    expect(pressable).toContain('motion-reduce:active:scale-100');
  });

  it('darkens a danger button under the pointer rather than fading it', () => {
    const classes = render(<Button variant="danger">Delete</Button>).getByRole('button', { name: 'Delete' }).className;
    expect(classes).toContain('hover:brightness-95');
    expect(classes).not.toContain('hover:opacity');
  });
});
