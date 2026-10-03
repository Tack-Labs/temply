import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { Button, pressable } from './button';

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

  it('keeps fine-pointer density and reaches 44px under a coarse pointer', () => {
    const view = render(
      <>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Icon" />
      </>,
    );
    const medium = view.getByRole('button', { name: 'Medium' }).className;
    expect(medium).toContain('h-8');
    expect(medium).toContain('pointer-coarse:h-11');
    const large = view.getByRole('button', { name: 'Large' }).className;
    expect(large).toContain('h-10');
    expect(large).toContain('pointer-coarse:h-11');
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
  it('pressable carries its own focus outline, a solid 2px accent-ink, not the 25% ring that measured 1.4:1', () => {
    const own = pressable.split(/\s+/);
    for (const needed of ['focus-visible:outline-2', 'focus-visible:outline-offset-2', 'focus-visible:outline-accent-ink']) {
      expect(own).toContain(needed);
    }
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
