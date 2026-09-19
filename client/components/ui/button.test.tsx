import { afterEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { cleanup, render } from '@testing-library/react';
import { Button } from './button';

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
});
