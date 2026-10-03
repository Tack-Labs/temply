'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Kicker } from '~/components/marketing/kicker';
import { useParallax } from '~/hooks/use-parallax';
import { useReveal } from '~/hooks/use-reveal';
import { cn } from '~/lib/classname';

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
  /** The row sits on the accent fill, so its text and pill are the on-accent
   *  forms and the glow, which would be accent on accent, is left out. */
  band?: boolean;
  /** A call to action under the description. */
  action?: ReactNode;
}

export function ShowcaseRow({
  stage,
  title,
  description,
  visual,
  flipped = false,
  band = false,
  action,
}: ShowcaseRowProps) {
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
          {/* A whisper of the hero's accent glow behind each panel, so the page
              keeps its atmosphere after the backdrop fades. The element's own
              transform makes it a stacking context, so -z-10 stays inside it
              instead of falling behind the page background. */}
          {band ? null : (
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10 blur-2xl"
              style={{
                background:
                  'radial-gradient(ellipse at center, color-mix(in oklab, var(--ds-accent) 10%, transparent), transparent 70%)',
              }}
            />
          )}
          {visual}
        </div>
      </div>

      <div className="reveal-copy lg:w-[43%]">
        <Kicker onAccent={band}>{stage}</Kicker>
        <h3
          className={cn(
            'mt-5 font-display text-2xl font-semibold tracking-display text-balance lg:text-3xl',
            band ? 'text-on-accent' : 'text-ink',
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'mt-4 max-w-md text-lg leading-relaxed text-pretty',
            band ? 'text-on-accent' : 'text-muted',
          )}
        >
          {description}
        </p>
        {action ? <div className="mt-7">{action}</div> : null}
      </div>
    </div>
  );
}
