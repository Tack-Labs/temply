import { afterEach, describe, expect, it, mock } from 'bun:test';
import '../core/editor/test/dom';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { SaveStatus } from './save-status';

afterEach(cleanup);

describe('SaveStatus', () => {
  it('says nothing to a reader until a save is under way, and says it once, in the live region', () => {
    const idle = render(<SaveStatus status="idle" onRetry={() => {}} />);
    expect(idle.getByRole('status').textContent).toBe('');
    cleanup();

    const saved = render(<SaveStatus status="saved" onRetry={() => {}} />);
    expect(saved.getByRole('status').textContent).toBe('Saved');
  });

  it('offers Retry only after a failure, and asks for the save again when it is pressed', () => {
    const onRetry = mock(() => {});
    const saving = render(<SaveStatus status="saving" onRetry={onRetry} />);
    expect(saving.queryByRole('button', { name: 'Retry' })).toBeNull();
    cleanup();

    const failed = render(<SaveStatus status="error" onRetry={onRetry} />);
    expect(failed.getByRole('status').textContent).toBe('Not saved');
    fireEvent.click(failed.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('keeps Retry compact for a mouse and gives it a 44px target for a thumb', () => {
    const view = render(<SaveStatus status="error" onRetry={() => {}} />);
    const retry = view.getByRole('button', { name: 'Retry' });
    // The strip sits beside the template's name, so on a fine pointer the
    // control is the height of its text; only a coarse pointer grows it.
    expect(retry.className).toContain('h-auto');
    expect(retry.className).toContain('pointer-coarse:h-11');
    expect(retry.className).toContain('pointer-coarse:min-w-11');
  });

  it('is the size of the word beside it, whatever size the strip is given', () => {
    // The editor's header sets the strip to `text-base`; a Retry fixed at
    // `text-xs` was a smaller word than "Not saved" next to it.
    const view = render(<SaveStatus status="error" className="text-base" onRetry={() => {}} />);
    const retry = view.getByRole('button', { name: 'Retry' });
    expect(retry.className).not.toContain('text-xs');
    expect(retry.className).toContain('text-[length:inherit]');
  });
});
