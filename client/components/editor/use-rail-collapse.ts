'use client';

import { useCallback, useLayoutEffect, useState } from 'react';

export type RailSide = 'left' | 'right';

export function railStorageKey(side: RailSide): string {
  return `temply.editor.rail.${side}`;
}

function read(side: RailSide): boolean {
  try {
    return window.localStorage.getItem(railStorageKey(side)) === 'collapsed';
  } catch {
    // Private mode or blocked site data: the rail starts open.
    return false;
  }
}

function write(side: RailSide, collapsed: boolean): void {
  try {
    window.localStorage.setItem(railStorageKey(side), collapsed ? 'collapsed' : 'open');
  } catch {
    // Not remembered this time; the rail still collapses for the session.
  }
}

/**
 * Whether one of the editor's rails is collapsed to its strip, remembered per
 * rail and per browser.
 *
 * The server and the first client render both say "open", because storage is
 * the browser's and the markup has to agree through hydration; the stored
 * choice is applied in a layout effect, before the first paint of a client
 * navigation. `animate` is what keeps that restore from moving: it stays
 * false until the reader toggles, and the width and crossfade transitions are
 * only switched on with it, so a page that opens collapsed is already at rest
 * and a first toggle still eases. A page the server rendered has painted its
 * open markup before any of this runs, so a collapsed rail snaps shut there
 * once; storage cannot be read earlier than hydration.
 */
export function useRailCollapse(side: RailSide): {
  collapsed: boolean;
  animate: boolean;
  toggle: () => void;
} {
  const [collapsed, setCollapsed] = useState(false);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    setCollapsed(read(side));
  }, [side]);

  const toggle = useCallback(() => {
    const next = !collapsed;
    setAnimate(true);
    setCollapsed(next);
    write(side, next);
  }, [collapsed, side]);

  return { collapsed, animate, toggle };
}
