import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import '../../core/editor/test/dom';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useCloseWhenWide } from './mobile-nav';

// The drawer's open state is Radix's to hold, and Radix portals do not mount
// in the test DOM; the hook that closes it on widening is the part with a rule
// of its own, so it is read here and the real drawer in shell.e2e.ts.

type Listener = () => void;

/** A window whose width the test turns, the way a phone does when it rotates. */
function fakeViewport(initialWide: boolean) {
  let wide = initialWide;
  const listeners = new Set<Listener>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === '(min-width: 48rem)' ? wide : false;
    },
    addEventListener: (_: 'change', fn: Listener) => listeners.add(fn),
    removeEventListener: (_: 'change', fn: Listener) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  return {
    resize(next: boolean) {
      wide = next;
      act(() => {
        for (const fn of listeners) fn();
      });
    },
    restore() {
      window.matchMedia = original;
    },
  };
}

let viewport: ReturnType<typeof fakeViewport>;
afterEach(() => {
  cleanup();
  viewport?.restore();
});

describe('useCloseWhenWide', () => {
  let closed: boolean[];
  const setOpen = (open: boolean) => closed.push(open);
  beforeEach(() => {
    closed = [];
  });

  it('closes an open drawer when the window grows past md', () => {
    viewport = fakeViewport(false);
    renderHook(() => useCloseWhenWide(true, setOpen));
    expect(closed).toEqual([]);

    viewport.resize(true);
    expect(closed).toEqual([false]);
  });

  it('leaves a closed drawer alone, however the window changes', () => {
    viewport = fakeViewport(false);
    renderHook(() => useCloseWhenWide(false, setOpen));

    viewport.resize(true);
    viewport.resize(false);
    expect(closed).toEqual([]);
  });

  it('leaves an open drawer alone while the window stays narrow', () => {
    viewport = fakeViewport(false);
    renderHook(() => useCloseWhenWide(true, setOpen));

    viewport.resize(false);
    expect(closed).toEqual([]);
  });

  it('closes a drawer that is somehow open at a wide width, since nothing on screen could close it', () => {
    viewport = fakeViewport(true);
    renderHook(() => useCloseWhenWide(true, setOpen));
    expect(closed).toEqual([false]);
  });

  it('stops listening when the nav unmounts', () => {
    viewport = fakeViewport(false);
    const view = renderHook(() => useCloseWhenWide(true, setOpen));
    view.unmount();

    viewport.resize(true);
    expect(closed).toEqual([]);
  });
});
