import { afterEach, expect, spyOn, test } from 'bun:test';
import '../../core/editor/test/dom';
import { act, cleanup, render } from '@testing-library/react';
import { WorkspaceSetupFallback } from './create-workspace';

afterEach(cleanup);

test('workspace setup shows a loading message before Clerk mounts the form', () => {
  const view = render(<WorkspaceSetupFallback />);
  expect(view.getByRole('status').textContent).toBe('Loading workspace setup...');
  expect(view.queryByRole('alert')).toBeNull();
});

test('a form that never mounts offers retry and support, and cleans up its timer', () => {
  const schedule = globalThis.setTimeout;
  let expire: (() => void) | undefined;
  let setupTimer: ReturnType<typeof setTimeout> | undefined;
  const timeout = spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    if (delay === 10_000 && typeof callback === 'function') {
      expire = () => callback(...args);
      setupTimer = timer;
    }
    return timer;
  });
  const cancel = spyOn(globalThis, 'clearTimeout');
  try {
    const view = render(<WorkspaceSetupFallback />);
    expect(expire).toBeDefined();
    if (!expire) throw new Error('Workspace setup did not schedule its timeout');
    act(expire);
    expect(view.getByRole('alert').textContent).toContain('Workspace setup could not load.');
    expect(view.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(view.getByRole('link', { name: 'contact support' }).getAttribute('href')).toMatch(/^mailto:/);
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(setupTimer);
  } finally {
    cleanup();
    timeout.mockRestore();
    cancel.mockRestore();
  }
});
