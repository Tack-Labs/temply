'use client';

import { useEffect, useState } from 'react';

export type ViewportFrame = { top: number; height: number };

/** Where the visible part of the page is, in layout-viewport pixels. iOS
 *  keeps the layout viewport at full height when the keyboard opens and
 *  instead shrinks — and may scroll — the visual one; a frame sized and
 *  placed from these two numbers is exactly the part of the screen a finger
 *  can reach. */
export function viewportFrame(vv: { height: number; offsetTop: number }): ViewportFrame {
  return { top: Math.round(vv.offsetTop), height: Math.round(vv.height) };
}

/**
 * The visual viewport as state, or null until the first client effect (and
 * for good on a browser without `visualViewport`), so the caller can fall
 * back to CSS units. Updates on every resize and scroll of the visual
 * viewport: keyboard open and close, and the scrolling iOS does under an
 * open keyboard.
 */
export function useVisualViewport(): ViewportFrame | null {
  const [frame, setFrame] = useState<ViewportFrame | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // One state write per animation frame: iOS fires resize and scroll many
    // times while the keyboard animates, and a frame that re-laid out on
    // each of them stuttered up the screen.
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setFrame(viewportFrame(vv)));
    };
    setFrame(viewportFrame(vv));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return frame;
}
