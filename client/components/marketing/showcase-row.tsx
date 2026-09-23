'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useParallax } from '~/hooks/use-parallax';
import { useReveal } from '~/hooks/use-reveal';

interface ShowcaseRowProps {
  /** The stage of the workflow this row belongs to — Build, Check, Ship, Reuse.
   *  These are a real sequence, which is why they are allowed to act as the
   *  structural marker instead of decorative 01/02/03 numbering. */
  stage: string;
  title: string;
  description: string;
  /** The CSS mock that stands in for a screenshot. */
  visual: ReactNode;
  /** Every other row flips, so the eye zig-zags down the page. */
  flipped?: boolean;
}

export function ShowcaseRow({ stage, title, description, visual, flipped = false }: ShowcaseRowProps) {
  const rowRef = useReveal();
  // Relative parallax: the panel lags the scroll by a few pixels as it crosses
  // the viewport. Small numbers on purpose — it should register as depth, not
  // as an effect.
  const visualRef = useParallax(0.06, 18, { relative: true });

  return (
    <div
      ref={rowRef}
      data-reveal
      className={`flex flex-col gap-8 lg:items-center lg:gap-16 ${
        flipped ? 'lg:flex-row-reverse' : 'lg:flex-row'
      }`}
    >
      {/* Parallax rides the outer wrapper as an inline transform; the entrance
          slide lives on the inner .reveal-visual as a transitioned transform.
          Two elements because one element cannot carry both. */}
      <div
        ref={visualRef}
        className="w-full will-change-transform lg:w-[57%]"
        style={{ transform: 'translate3d(0, var(--parallax-y, 0), 0)' }}
      >
        <div
          className="reveal-visual relative"
          style={{ '--reveal-from': flipped ? '28px' : '-28px' } as CSSProperties}
        >
          {/* A whisper of the hero's indigo behind each panel, so the page
              keeps its atmosphere after the backdrop fades. The element's own
              transform makes it a stacking context, so -z-10 stays inside it
              instead of falling behind the page background. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10 blur-2xl"
            style={{
              background:
                'radial-gradient(ellipse at center, color-mix(in oklab, var(--ds-accent) 10%, transparent), transparent 70%)',
            }}
          />
          {visual}
        </div>
      </div>

      <div className="reveal-copy lg:w-[43%]">
        <p className="flex items-center gap-2.5 font-mono text-2xs tracking-[0.16em] text-accent-ink uppercase">
          <span aria-hidden className="h-px w-6 bg-accent-ink/45" />
          {stage}
        </p>
        <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight text-balance text-ink lg:text-3xl">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-pretty text-muted">
          {description}
        </p>
      </div>
    </div>
  );
}
