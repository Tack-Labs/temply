import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import '../../core/editor/test/dom';
import { act, cleanup, renderHook } from '@testing-library/react';
import { railStorageKey, useRailCollapse } from './use-rail-collapse';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('useRailCollapse', () => {
  it('starts open, with nothing to animate', () => {
    const { result } = renderHook(() => useRailCollapse('left'));
    expect(result.current.collapsed).toBe(false);
    expect(result.current.animate).toBe(false);
  });

  it('collapses and opens with the toggle, and animates from the first one', () => {
    const { result } = renderHook(() => useRailCollapse('left'));
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    expect(result.current.animate).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.animate).toBe(true);
  });

  it('remembers the choice for the next visit', () => {
    const first = renderHook(() => useRailCollapse('right'));
    act(() => first.result.current.toggle());
    expect(window.localStorage.getItem(railStorageKey('right'))).toBe('collapsed');
    first.unmount();

    const second = renderHook(() => useRailCollapse('right'));
    expect(second.result.current.collapsed).toBe(true);

    act(() => second.result.current.toggle());
    expect(window.localStorage.getItem(railStorageKey('right'))).toBe('open');
  });

  it('restores a stored collapse without animating it', () => {
    window.localStorage.setItem(railStorageKey('left'), 'collapsed');
    const { result } = renderHook(() => useRailCollapse('left'));
    expect(result.current.collapsed).toBe(true);
    // The width and the crossfade only transition once the reader has asked
    // for a change, so a page that opens collapsed is already at rest.
    expect(result.current.animate).toBe(false);
  });

  it('keeps the two rails apart', () => {
    window.localStorage.setItem(railStorageKey('left'), 'collapsed');
    const left = renderHook(() => useRailCollapse('left'));
    const right = renderHook(() => useRailCollapse('right'));
    expect(left.result.current.collapsed).toBe(true);
    expect(right.result.current.collapsed).toBe(false);
    act(() => right.result.current.toggle());
    expect(left.result.current.collapsed).toBe(true);
    expect(window.localStorage.getItem(railStorageKey('left'))).toBe('collapsed');
  });

  it('opens when what is stored is not a value it wrote', () => {
    window.localStorage.setItem(railStorageKey('left'), '{"collapsed":true}');
    const { result } = renderHook(() => useRailCollapse('left'));
    expect(result.current.collapsed).toBe(false);
  });

  describe('with storage unavailable', () => {
    it('opens when reading throws', () => {
      const read = spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      try {
        const { result } = renderHook(() => useRailCollapse('left'));
        expect(result.current.collapsed).toBe(false);
      } finally {
        read.mockRestore();
      }
    });

    it('still toggles for the session when writing throws', () => {
      const write = spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      try {
        const { result } = renderHook(() => useRailCollapse('left'));
        act(() => result.current.toggle());
        expect(result.current.collapsed).toBe(true);
        act(() => result.current.toggle());
        expect(result.current.collapsed).toBe(false);
      } finally {
        write.mockRestore();
      }
    });
  });
});
