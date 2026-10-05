'use client';
import { useEffect } from 'react';

const FLAG = 'data-smooth-scroll';

/** Raises `html[data-smooth-scroll]`, which is what the stylesheet's smooth
 *  scrolling is conditional on, once the page has loaded and its fonts are in.
 *
 *  Before that the browser jumps. A link followed into the page is scrolled to
 *  on arrival, and an ease started then is aimed at where the target stood
 *  before the fonts swapped in: the swap moves it, the ease does not follow,
 *  and the heading lands under the sticky bar. Links followed after the flag
 *  is up ease as they always did. */
export function SmoothScroll() {
  useEffect(() => {
    const root = document.documentElement;
    let cancelled = false;
    const raise = () => {
      void document.fonts.ready.then(() => {
        if (!cancelled) root.setAttribute(FLAG, '');
      });
    };
    if (document.readyState === 'complete') raise();
    else window.addEventListener('load', raise, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', raise);
      root.removeAttribute(FLAG);
    };
  }, []);

  return null;
}
