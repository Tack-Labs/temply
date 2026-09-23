'use client';

import { useEffect, useState } from 'react';
import { ArrowUpIcon } from 'lucide-react';

/** How far down the page the button earns its place. Roughly one screen. */
const SHOW_AFTER_PX = 400;

/** A way back to the top once the page is long enough to need one. Stays mounted
 *  so it can fade both ways, and is taken out of the tab order while hidden. */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const scrollToTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-5 bottom-5 z-40 flex size-10 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-[opacity,transform] duration-300 hover:bg-accent-hover sm:right-8 sm:bottom-8 ${
        visible ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUpIcon className="size-4" />
    </button>
  );
}
